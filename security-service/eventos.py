"""Contrato de los eventos: topics y "plantillas" de cada evento.

Que es un topic
---------------
Un topic es una "columna" o un "buzon" con nombre dentro de Kafka. Todo lo que
se publica en `seguridad.accesos` queda ordenado y Together en ese mismo buzon.
Por eso conviene agrupar por tipo de evento: asi despues es facil crear un
consumidor que solo lea lo que le interesa.

Regla de este archivo: aqui SOLO se construyen diccionarios.
No se manda nada a Kafka. El envio lo hace `kafka_producer.publicar_evento`.
Asi es facil probar que los eventos tienen la forma correcta sin levantar Kafka.
"""

from __future__ import annotations

from typing import Any

# --- Topics -----------------------------------------------------------------

# Todo lo que tiene que ver con la seguridad: accesos correctos, accesos
# rechazados, tokens invalidos. Es el topic del ejemplo del documento.
TOPIC_SEGURIDAD = "seguridad.accesos"

# Los eventos de negocio (pedidos de la cocina) van aparte, para que el
# servicio de cocina no tenga que filtrar ruido de seguridad.
TOPIC_PEDIDOS = "pedidos.eventos"

# Todos los topics del servicio. Se usa en el script `ver_eventos.py`.
TODOS_LOS_TOPICS = (TOPIC_SEGURIDAD, TOPIC_PEDIDOS)

# --- Tipos de evento de seguridad ------------------------------------------

ACCESO_SIN_TOKEN = "acceso_sin_token"
TOKEN_INVALIDO = "token_invalido"
ACCESO_PERMITIDO = "acceso_permitido"
ACCESO_DENEGADO = "acceso_denegado"
USUARIO_SIN_ROL = "usuario_sin_rol"


def _base_peticion(endpoint: str, metodo: str, ip: str | None) -> dict[str, Any]:
    """Datos que son comunes a todo evento de peticion HTTP.

    `ip` puede llegar como `None`: pasa cuando la peticion viene por un proxy
    y Flask no logra deducir la direccion real.
    """
    return {
        "endpoint": endpoint,
        "metodo": metodo,
        "ip": ip,
    }


def evento_acceso_sin_token(endpoint: str, metodo: str, ip: str | None) -> dict[str, Any]:
    """Peticion a una ruta protegida sin cabecera Authorization.

    Es el ejemplo literal del documento: alguien intento entrar sin token.
    """
    return {
        "tipo": ACCESO_SIN_TOKEN,
        "resultado": "rechazado",
        **_base_peticion(endpoint, metodo, ip),
    }


def evento_token_invalido(
    endpoint: str,
    metodo: str,
    ip: str | None,
    motivo: str,
) -> dict[str, Any]:
    """Habia token, pero Keycloak lo rechazo (caducado, mal firmado, otro emisor...)."""
    return {
        "tipo": TOKEN_INVALIDO,
        "resultado": "rechazado",
        "motivo": motivo,
        **_base_peticion(endpoint, metodo, ip),
    }


def evento_acceso_permitido(
    endpoint: str,
    metodo: str,
    ip: str | None,
    usuario: str,
    roles: list[str] | None = None,
) -> dict[str, Any]:
    """La peticion paso la validacion del token."""
    return {
        "tipo": ACCESO_PERMITIDO,
        "resultado": "permitido",
        "usuario": usuario,
        "roles": sorted(roles or []),
        **_base_peticion(endpoint, metodo, ip),
    }


def evento_acceso_denegado(
    endpoint: str,
    metodo: str,
    ip: str | None,
    usuario: str,
    roles_usuario: list[str] | None,
    roles_requeridos: list[str],
) -> dict[str, Any]:
    """El token era valido, pero al usuario le faltan permisos."""
    return {
        "tipo": ACCESO_DENEGADO,
        "resultado": "rechazado",
        "usuario": usuario,
        "roles_usuario": sorted(roles_usuario or []),
        "roles_requeridos": sorted(roles_requeridos),
        **_base_peticion(endpoint, metodo, ip),
    }


def evento_usuario_sin_rol(
    endpoint: str,
    metodo: str,
    ip: str | None,
    usuario: str,
    roles_usuario: list[str] | None,
) -> dict[str, Any]:
    """El usuario no tiene ninguno de los roles que exige la ruta."""
    return {
        "tipo": USUARIO_SIN_ROL,
        "resultado": "rechazado",
        "usuario": usuario,
        "roles_usuario": sorted(roles_usuario or []),
        **_base_peticion(endpoint, metodo, ip),
    }


# --- Eventos de negocio -----------------------------------------------------


def evento_pedido_creado(
    pedido_id: str,
    codigo: str,
    canal: str,
    usuario: str,
) -> dict[str, Any]:
    """Ejemplo de evento de negocio, para mostrar que el mismo productor
    tambien sirve para los pedidos de la cocina."""
    return {
        "tipo": "pedido_creado",
        "pedido_id": pedido_id,
        "codigo": codigo,
        "canal": canal,
        "usuario": usuario,
    }
