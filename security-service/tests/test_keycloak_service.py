"""Pruebas de `keycloak_service`: la validacion del token.

Estas pruebas NO necesitan Keycloak: `cliente_jwks_falso` sustituye la
descarga de llaves por una generada en memoria, asi que lo que se comprueba
es la verificacion real (firma, caducidad, emisor, roles).
"""

from __future__ import annotations

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

import keycloak_service
from config import config
from keycloak_service import TokenInvalidoError, verificar_token
from tests.conftest import KID_DE_PRUEBAS


def test_token_valido_devuelve_el_usuario(cliente_jwks_falso, fabricar_token) -> None:
    token = fabricar_token(roles=["KITCHEN_OPERATOR"], usuario="cocina")

    usuario = verificar_token(token)

    assert usuario.username == "cocina"
    assert usuario.id == "uuid-de-cocina"
    assert usuario.email == "cocina@kds.local"
    assert "KITCHEN_OPERATOR" in usuario.roles


def test_sin_roles_devuelve_usuario_sin_roles(cliente_jwks_falso, fabricar_token) -> None:
    usuario = verificar_token(fabricar_token(roles=[]))

    assert usuario.roles == frozenset()


def test_acepta_algoritmo_que_no_es_rs256(cliente_jwks_falso, fabricar_token, llave_privada) -> None:
    """Vulnerabilidad clasica de JWT: si el servidor acepta el algoritmo que
    pide el propio token, alguien puede poner 'alg: none' y colarse sin firma.

    Comprobamos que aqui NO se acepta."""
    ahora = int(time.time())
    token_sin_firma = jwt.encode(
        {
            "sub": "atacante",
            "preferred_username": "atacante",
            "iss": config.keycloak.emisor,
            "iat": ahora,
            "exp": ahora + 300,
        },
        key="",
        algorithm="none",
    )

    with pytest.raises(TokenInvalidoError) as error:
        verificar_token(token_sin_firma)

    assert error.value.motivo in {"token_mal_formado", "firma_invalida", "token_no_valido"}


def test_rechaza_token_caducado(cliente_jwks_falso, fabricar_token) -> None:
    token = fabricar_token(expira_en=-10)  # ya paso la hora

    with pytest.raises(TokenInvalidoError) as error:
        verificar_token(token)

    assert error.value.motivo == "token_caducado"


def test_rechaza_token_de_otro_emisor(cliente_jwks_falso, fabricar_token) -> None:
    """Un token de OTRO Keycloak no nos sirve, aunque la firma sea buena."""
    token = fabricar_token(issuer="http://keycloak-de-otro.local/realms/otro")

    with pytest.raises(TokenInvalidoError) as error:
        verificar_token(token)

    assert error.value.motivo == "emisor_no_valido"


def test_rechaza_token_firmado_con_otra_llave(cliente_jwks_falso, fabricar_token) -> None:
    """Token bien formado y sin caducar, pero firmado por alguien que no es
    nuestro Keycloak. Es el ataque clasico de sustitucion."""
    otra_llave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ahora = int(time.time())
    token = jwt.encode(
        {
            "sub": "atacante",
            "preferred_username": "atacante",
            "iss": config.keycloak.emisor,
            "iat": ahora,
            "exp": ahora + 300,
        },
        otra_llave,
        algorithm="RS256",
        headers={"kid": KID_DE_PRUEBAS},
    )

    with pytest.raises(TokenInvalidoError) as error:
        verificar_token(token)

    assert error.value.motivo == "firma_invalida"


def test_rechaza_texto_que_no_es_token() -> None:
    with pytest.raises(TokenInvalidoError) as error:
        verificar_token("esto-no-es-un-token")

    assert error.value.motivo == "token_mal_formado"


def test_distingue_basura_de_llave_desconocida(cliente_jwks_falso) -> None:
    """Un token con forma de JWT pero con un `kid` que no existe es un caso
    distinto de un texto basura: dice algo del cliente, no del servidor."""
    ahora = int(time.time())
    token = jwt.encode(
        {"sub": "x", "iss": config.keycloak.emisor, "iat": ahora, "exp": ahora + 300},
        # 32 bytes: es el minimo que PyJWT acepta para HS256 sin avisar.
        "clave-inventada-de-32-bytes-larga",
        algorithm="HS256",
        headers={"kid": "una-llave-inventada"},
    )

    class ClienteSinLaLlave:
        def get_signing_key_from_jwt(self, _token: str):
            raise KeyError("Unable to find a signing key that matches: una-llave-inventada")

    import keycloak_service as modulo

    original = modulo.obtener_cliente_jwks
    modulo.obtener_cliente_jwks = ClienteSinLaLlave  # type: ignore[assignment]
    try:
        with pytest.raises(TokenInvalidoError) as error:
            verificar_token(token)
    finally:
        modulo.obtener_cliente_jwks = original  # type: ignore[assignment]

    assert error.value.motivo == "llave_no_encontrada"


def test_rechaza_token_vacio() -> None:
    with pytest.raises(TokenInvalidoError) as error:
        verificar_token("   ")

    assert error.value.motivo == "token_vacio"


def test_lectura_de_roles_del_realm(cliente_jwks_falso, fabricar_token) -> None:
    """`realm_access.roles` = roles de todo el realm."""
    usuario = verificar_token(fabricar_token(roles=["ADMIN", "KITCHEN_OPERATOR"]))

    assert usuario.roles_ordenados == ["ADMIN", "KITCHEN_OPERATOR"]


def test_lectura_de_roles_del_cliente(cliente_jwks_falso, fabricar_token) -> None:
    """`resource_access.<cliente>.roles` = roles de un cliente concreto."""
    token = fabricar_token(roles=["POS_SYSTEM"], cliente_id=config.keycloak.client_id)

    usuario = verificar_token(token)

    assert "POS_SYSTEM" in usuario.roles


def test_ignora_roles_por_defecto_de_keycloak(cliente_jwks_falso, fabricar_token) -> None:
    """`offline_access` y `uma_authorization` los mete Keycloak siempre.
    No son permisos de negocio y solo ensucian el evento de Kafka."""
    usuario = verificar_token(fabricar_token(roles=["ADMIN", "offline_access", "uma_authorization"]))

    assert usuario.roles_ordenados == ["ADMIN"]


def test_tiene_algun_rol(cliente_jwks_falso, fabricar_token) -> None:
    usuario = verificar_token(fabricar_token(roles=["KITCHEN_OPERATOR"]))

    assert usuario.tiene_algun_rol(["KITCHEN_OPERATOR", "ADMIN"]) is True
    assert usuario.tiene_algun_rol(["POS_SYSTEM"]) is False
    assert usuario.tiene_algun_rol([]) is False


def test_keycloak_caido_no_tumba_el_servicio(monkeypatch: pytest.MonkeyPatch, fabricar_token) -> None:
    """Si Keycloak esta apagado, el error debe decir eso, no "llave desconocida".

    Son fallos distintos: este es un problema NUESTRO, no un ataque.
    """
    # El token tiene que ser de forma valida: si no, el servicio lo rechaza
    # antes incluso de intentar contacting con Keycloak (que es lo correcto).
    token = fabricar_token(roles=["ADMIN"])

    class ClienteCaido:
        def get_signing_key_from_jwt(self, _token: str):
            raise ConnectionError("No se pudo conectar con Keycloak")

    monkeypatch.setattr(keycloak_service, "obtener_cliente_jwks", lambda: ClienteCaido())

    with pytest.raises(TokenInvalidoError) as error:
        verificar_token(token)

    assert error.value.motivo == "keycloak_no_disponible"
