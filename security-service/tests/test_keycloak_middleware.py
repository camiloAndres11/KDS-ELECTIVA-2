"""Pruebas del middleware de Keycloak y de los roles.

Se levanta la aplicacion Flask de verdad y se mandan peticiones con el
cliente de pruebas de Flask. No hace falta ni Kafka ni Keycloak.
"""

from __future__ import annotations

import pytest

import eventos
from app import crear_aplicacion


@pytest.fixture
def cliente(cliente_jwks_falso, registrador_eventos):
    """Aplicacion Flask lista para pruebas, con el middleware ya conectado."""
    app = crear_aplicacion()
    app.config["TESTING"] = True
    return app.test_client()


def _cabecera(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# --- Rutas publicas ---------------------------------------------------------


def test_health_es_publico(cliente) -> None:
    respuesta = cliente.get("/health")

    assert respuesta.status_code == 200
    assert respuesta.get_json()["estado"] == "ok"


def test_raiz_es_publica(cliente) -> None:
    assert cliente.get("/").status_code == 200


# --- Sin token: 401 + evento en Kafka --------------------------------------


def test_sin_token_responde_401(cliente) -> None:
    respuesta = cliente.get("/api/v1/perfil")

    assert respuesta.status_code == 401
    assert respuesta.get_json()["error"] == "token_requerido"


def test_sin_token_publica_el_evento_del_documento(cliente, registrador_eventos) -> None:
    """Este es el ejemplo del documento, comprobado de punta a punta."""
    cliente.get("/api/v1/perfil")

    eventos_publicados = registrador_eventos.de_tipo(eventos.ACCESO_SIN_TOKEN)
    assert len(eventos_publicados) == 1
    evento = eventos_publicados[0]
    assert evento["endpoint"] == "/api/v1/perfil"
    assert evento["metodo"] == "GET"
    assert evento["resultado"] == "rechazado"
    assert registrador_eventos.topics == [eventos.TOPIC_SEGURIDAD]


def test_cabecera_authorization_mal_formada_responde_401(cliente) -> None:
    """Sin la palabra "Bearer" el token no cuenta."""
    respuesta = cliente.get("/api/v1/perfil", headers={"Authorization": "abcdef.ghijkl"})

    assert respuesta.status_code == 401


def test_bearer_sin_token_responde_401(cliente) -> None:
    respuesta = cliente.get("/api/v1/perfil", headers={"Authorization": "Bearer "})

    assert respuesta.status_code == 401


# --- Token invalido: 401 + evento -------------------------------------------


def test_token_invalido_responde_401(cliente, registrador_eventos) -> None:
    respuesta = cliente.get("/api/v1/perfil", headers=_cabecera("token.inventado.aqui"))

    assert respuesta.status_code == 401
    assert len(registrador_eventos.de_tipo(eventos.TOKEN_INVALIDO)) == 1


def test_token_invalido_incluye_www_authenticate(cliente) -> None:
    """El estandar OAuth2 pide esta cabecera en un 401."""
    respuesta = cliente.get("/api/v1/perfil", headers=_cabecera("token.inventado.aqui"))

    assert "Bearer" in respuesta.headers.get("WWW-Authenticate", "")


# --- Token valido: 200 + usuario en g --------------------------------------


def test_token_valido_pasa(cliente, fabricar_token) -> None:
    token = fabricar_token(roles=["KITCHEN_OPERATOR"], usuario="cocina")

    respuesta = cliente.get("/api/v1/perfil", headers=_cabecera(token))

    assert respuesta.status_code == 200
    cuerpo = respuesta.get_json()
    assert cuerpo["usuario"] == "cocina"
    assert cuerpo["roles"] == ["KITCHEN_OPERATOR"]


def test_acceso_permitido_publica_evento(cliente, fabricar_token, registrador_eventos) -> None:
    token = fabricar_token(roles=["KITCHEN_OPERATOR"], usuario="cocina")

    cliente.get("/api/v1/perfil", headers=_cabecera(token))

    publicados = registrador_eventos.de_tipo(eventos.ACCESO_PERMITIDO)
    assert len(publicados) == 1
    assert publicados[0]["usuario"] == "cocina"
    assert publicados[0]["resultado"] == "permitido"
    assert publicados[0]["roles"] == ["KITCHEN_OPERATOR"]


def test_se_puede_apagar_el_registro_de_accesos(cliente_jwks_falso, fabricar_token, registrador_eventos) -> None:
    """Con PUBLICAR_ACCESOS_PERMITIDOS=false, un acceso valido no genera evento.

    Los rechazos se siguen guardando: son los que de verdad interesa.
    """
    app = crear_aplicacion()
    app.config["TESTING"] = True
    app.config["PUBLICAR_ACCESOS_PERMITIDOS"] = False
    cliente_sin_registro = app.test_client()
    token = fabricar_token(roles=["KITCHEN_OPERATOR"], usuario="cocina")

    assert cliente_sin_registro.get("/api/v1/perfil", headers=_cabecera(token)).status_code == 200
    assert registrador_eventos.de_tipo(eventos.ACCESO_PERMITIDO) == []


# --- Roles: 403 + evento ----------------------------------------------------


def test_rol_correcto_permite_pasar(cliente, fabricar_token) -> None:
    token = fabricar_token(roles=["KITCHEN_OPERATOR"], usuario="cocina")

    respuesta = cliente.get("/api/v1/pedidos", headers=_cabecera(token))

    assert respuesta.status_code == 200
    assert respuesta.get_json()["total"] == 2


def test_admin_puede_hacer_todo(cliente, fabricar_token) -> None:
    token = fabricar_token(roles=["ADMIN"], usuario="admin")

    assert cliente.get("/api/v1/pedidos", headers=_cabecera(token)).status_code == 200
    assert cliente.post("/api/v1/pedidos", json={}, headers=_cabecera(token)).status_code == 201


def test_rol_equivocado_responde_403(cliente, fabricar_token) -> None:
    """`cocina` puede leer pedidos, pero no puede crearlos."""
    token = fabricar_token(roles=["KITCHEN_OPERATOR"], usuario="cocina")

    respuesta = cliente.post("/api/v1/pedidos", json={}, headers=_cabecera(token))

    assert respuesta.status_code == 403
    assert respuesta.get_json()["error"] == "sin_permisos"


def test_rol_equivocado_publica_el_evento(cliente, fabricar_token, registrador_eventos) -> None:
    token = fabricar_token(roles=["KITCHEN_OPERATOR"], usuario="cocina")

    cliente.post("/api/v1/pedidos", json={}, headers=_cabecera(token))

    publicados = registrador_eventos.de_tipo(eventos.ACCESO_DENEGADO)
    assert len(publicados) == 1
    evento = publicados[0]
    assert evento["usuario"] == "cocina"
    assert evento["roles_usuario"] == ["KITCHEN_OPERATOR"]
    assert "POS_SYSTEM" in evento["roles_requeridos"]


def test_usuario_sin_ningun_rol(cliente, fabricar_token) -> None:
    token = fabricar_token(roles=[], usuario="visitante")

    respuesta = cliente.get("/api/v1/pedidos", headers=_cabecera(token))

    assert respuesta.status_code == 403


def test_cualquier_token_valido_llega_a_perfil(cliente, fabricar_token) -> None:
    """`/api/v1/perfil` no pide rol: basta con estar autenticado."""
    token = fabricar_token(roles=[], usuario="visitante")

    assert cliente.get("/api/v1/perfil", headers=_cabecera(token)).status_code == 200


# --- Seguridad desactivada (para trabajar sin Keycloak) --------------------


def test_se_puede_desactivar_la_seguridad(registrador_eventos) -> None:
    """Con AUTH_HABILITADO=false se puede trabajar en local sin Keycloak."""
    app = crear_aplicacion()
    app.config["TESTING"] = True
    app.config["AUTH_HABILITADO"] = False
    cliente = app.test_client()

    assert cliente.get("/api/v1/pedidos").status_code == 200
    assert registrador_eventos.eventos == []


# --- Evento de negocio ------------------------------------------------------


def test_crear_pedido_publica_en_el_topic_de_pedidos(cliente, fabricar_token, registrador_eventos) -> None:
    token = fabricar_token(roles=["POS_SYSTEM"], usuario="caja")

    respuesta = cliente.post(
        "/api/v1/pedidos",
        json={"codigo": "#P-2001", "canal": "DELIVERY"},
        headers=_cabecera(token),
    )

    assert respuesta.status_code == 201
    assert respuesta.get_json()["creado_por"] == "caja"
    assert eventos.TOPIC_PEDIDOS in registrador_eventos.topics
    creado = registrador_eventos.de_tipo("pedido_creado")[0]
    assert creado["codigo"] == "#P-2001"
    assert creado["canal"] == "DELIVERY"


def test_los_riesgos_de_sonido_solo_al_lista_de_rol(cliente, fabricar_token) -> None:
    """Sonda: si el middleware dejara pasar algo, este test lo detectaria."""
    token = fabricar_token(roles=["KITCHEN_OPERATOR"], usuario="cocina")

    # Lectura: permitida.
    assert cliente.get("/api/v1/pedidos", headers=_cabecera(token)).status_code == 200
    # Escritura: prohibida.
    assert cliente.post("/api/v1/pedidos", json={}, headers=_cabecera(token)).status_code == 403
