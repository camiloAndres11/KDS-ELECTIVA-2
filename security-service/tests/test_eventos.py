"""Pruebas de `eventos`: que cada plantilla tenga los campos que debe.

Son pruebas "de contrato": no miran Kafka, solo que el diccionario que se
construye tenga la forma que acordamos. Si alguien renombra un campo, el
consumidor del otro lado se rompe, asi que conviene fijarlo aqui.
"""

from __future__ import annotations

import eventos


def test_los_topics_de_sonencia_empiezan_por_punto() -> None:
    """La convencion `servicio.entidad` hace ordenables los topics."""
    for topic in eventos.TODOS_LOS_TOPICS:
        servicio, _, entidad = topic.partition(".")
        assert servicio, f"el topic '{topic}' no dice de que servicio es"
        assert entidad, f"el topic '{topic}' no dice de que entidad es"


def test_los_events_de_seguridad_llevan_lo_basico() -> None:
    """Endpoint, metodo e IP son los tres datos minimos de cualquier peticion."""
    plantillas = [
        eventos.evento_acceso_sin_token("/api/v1/pedidos", "GET", "10.0.0.1"),
        eventos.evento_token_invalido("/api/v1/pedidos", "GET", "10.0.0.1", "token_caducado"),
        eventos.evento_acceso_permitido("/api/v1/pedidos", "GET", "10.0.0.1", "cocina", ["ADMIN"]),
        eventos.evento_acceso_denegado(
            "/api/v1/pedidos", "POST", "10.0.0.1", "cocina", ["KITCHEN_OPERATOR"], ["POS_SYSTEM"]
        ),
        eventos.evento_usuario_sin_rol("/api/v1/pedidos", "GET", "10.0.0.1", "visitante", []),
    ]

    for evento in plantillas:
        assert evento["tipo"], "todo evento necesita un tipo"
        assert evento["endpoint"]
        assert evento["metodo"]
        assert "ip" in evento, "la clave 'ip' siempre debe existir, aunque valga None"


def test_los_roles_siempre_vienen_ordenados() -> None:
    """Ordenarlos hace que dos ejecuciones den exactamente el mismo evento,
    que es lo que hace comparables los tests y los logs."""
    evento = eventos.evento_acceso_permitido(
        "/x", "GET", None, "cocina", ["KITCHEN_OPERATOR", "ADMIN", "DISPATCHER"]
    )

    assert evento["roles"] == ["ADMIN", "DISPATCHER", "KITCHEN_OPERATOR"]


def test_una_ip_desconocida_no_rompe_nada() -> None:
    """A veces no hay IP (peticion por proxy). Debe quedar `None`, no fallar."""
    evento = eventos.evento_acceso_sin_token("/health", "GET", None)

    assert evento["ip"] is None


def test_los_accesos_rechazados_lo_dicen() -> None:
    """Poder filtrar en kafka-ui por 'resultado' es el motivo del campo."""
    assert eventos.evento_acceso_sin_token("/a", "GET", None)["resultado"] == "rechazado"
    assert eventos.evento_acceso_permitido("/a", "GET", None, "cocina")["resultado"] == "permitido"


def test_evento_de_pedido() -> None:
    evento = eventos.evento_pedido_creado("id-1", "#P-1", "DINE_IN", "caja")

    assert evento["tipo"] == "pedido_creado"
    assert evento["codigo"] == "#P-1"
    assert evento["usuario"] == "caja"
