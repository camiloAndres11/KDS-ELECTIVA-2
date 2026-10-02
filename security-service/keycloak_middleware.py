"""Middleware de Keycloak para Flask.

Que es un middleware
-------------------
Es un trozo de codigo que se ejecuta automaticamente ANTES de cada peticion,
sin que la ruta tenga que acordarse de llamarlo. Si el middleware responde, la
ruta nunca se ejecuta.

Que hace este
-------------
1. Las rutas publicas (por ejemplo `/health`) pasan sin pedir token.
2. Las demas exigen la cabecera `Authorization: Bearer <token>`.
3. Valida el token con Keycloak.
4. Publica en Kafka un evento de `seguridad.accesos` con el resultado.

Respuestas
----------
- 200 o lo que sea      -> el token era valido, la ruta sigue su curso.
- 401 Unauthorized     -> falta el token, o es invalido/caducado.
- 403 Forbidden        -> el token es valido, pero al usuario le faltan roles.

La diferencia entre 401 y 403 es importante: 401 significa "no se quien eres"
y 403 significa "se quien eres, pero no puedes". El codigo del cliente usa
esa diferencia para pedir un token o para mostrar un mensaje de permisos.

Como se instala
---------------
    from flask import Flask
    from keycloak_middleware import registrar_middleware, requiere_rol

    app = Flask(__name__)
    registrar_middleware(app)              # protege todo lo que no sea publico

    @app.get("/api/v1/pedidos")
    @requiere_rol("KITCHEN_OPERATOR", "ADMIN")
    def listar_pedidos():
        ...
"""

from __future__ import annotations

import logging
from functools import wraps
from typing import Any, Callable, TypeVar

from flask import Flask, current_app, g, jsonify, request

import eventos
from config import config
from keycloak_service import TokenInvalidoError, Usuario, verificar_token
from kafka_producer import publicar_evento

logger = logging.getLogger(__name__)

# Sirve para conservar el tipo de la funcion cuando aplicamos `@wraps`.
F = TypeVar("F", bound=Callable[..., Any])

# Cabecera estandar de autenticacion con tokens.
CABECERA_AUTORIZACION = "Authorization"
PREFIJO_BEARER = "Bearer "


def _respuesta_error(
    estado: int,
    codigo: str,
    mensaje: str,
    cabeceras_extra: dict[str, str] | None = None,
) -> Any:
    """Arma la respuesta de error en el mismo formato para todos los casos.

    Devolver SIEMPRE la misma forma (aunque el error) permite al cliente
    procesar los errores de una sola vez.

    Flask acepta que se devuelva directamente un `Response`, tanto desde un
    `before_request` como desde una ruta, asi que no hace falta la pareja
    (respuesta, codigo).
    """
    respuesta = jsonify(
        {
            "error": codigo,
            "mensaje": mensaje,
            "estado": estado,
        }
    )
    respuesta.status_code = estado
    for nombre, valor in (cabeceras_extra or {}).items():
        respuesta.headers[nombre] = valor
    return respuesta


def _extraer_token() -> str | None:
    """Saca el token de la cabecera `Authorization`.

    Devuelve `None` si no hay cabecera, si no empieza por "Bearer ", o si
    despues de "Bearer " no queda nada. En cualquiera de esos casos la
    peticion no trae un token utilizable.
    """
    cabecera = request.headers.get(CABECERA_AUTORIZACION, "")
    if not cabecera:
        return None
    if not cabecera.startswith(PREFIJO_BEARER):
        return None
    token = cabecera[len(PREFIJO_BEARER) :].strip()
    return token or None


def _datos_de_la_peticion() -> tuple[str, str, str | None]:
    """Saca (endpoint, metodo, ip) de la peticion actual."""
    return request.path, request.method, request.remote_addr


def _publicar(topic: str, evento: dict[str, Any]) -> None:
    """Envoltorio de `publicar_evento` para poder desactivarlo en las pruebas."""
    if current_app.config.get("KDS_PUBLICAR_EVENTOS", True):
        publicar_evento(topic, evento)


def registrar_middleware(app: Flask) -> None:
    """Conecta el middleware de Keycloak a la aplicacion Flask.

    Se registra con `before_request`, que es el equivalente de un middleware
    en otros frameworks: Flask lo ejecuta antes de cada peticion.

    Ojo: los ajustes se leen de `app.config` DENTRO de la funcion de cada
    peticion, no al registrarla. Asi se pueden cambiar en caliente
    (`app.config["AUTH_HABILITADO"] = False`) sin tener que volver a
    conectar el middleware.
    """

    @app.before_request
    def _validar_acceso() -> Any:
        # Si el administrador apago la seguridad (AUTH_HABILITADO=false),
        # no comprobamos nada. Util para trabajar en local sin Keycloak.
        if not current_app.config.get("AUTH_HABILITADO", True):
            return None

        # Rutas publicas: health checks, pagina de inicio, etc.
        rutas_publicas = current_app.config.get("RUTAS_SIN_AUTENTICAR", ["/", "/health"])
        if request.path in rutas_publicas:
            return None

        endpoint, metodo, ip = _datos_de_la_peticion()

        # --- Caso 1: no hay token -------------------------------------------
        token = _extraer_token()
        if token is None:
            logger.warning("Peticion sin token a %s desde %s", endpoint, ip)
            _publicar(
                eventos.TOPIC_SEGURIDAD,
                eventos.evento_acceso_sin_token(endpoint, metodo, ip),
            )
            return _respuesta_error(
                401,
                "token_requerido",
                "Falta la cabecera Authorization con un token de Keycloak.",
            )

        # --- Caso 2: hay token, ¿es bueno? ----------------------------------
        try:
            usuario = verificar_token(token)
        except TokenInvalidoError as error:
            logger.warning("Token rechazado en %s (%s)", endpoint, error.motivo)
            _publicar(
                eventos.TOPIC_SEGURIDAD,
                eventos.evento_token_invalido(endpoint, metodo, ip, error.motivo),
            )
            # 401 con `WWW-Authenticate` es lo que dice el estandar OAuth2.
            return _respuesta_error(
                401,
                error.motivo,
                "El token no es valido.",
                cabeceras_extra={
                    "WWW-Authenticate": f'Bearer realm="{config.keycloak.realm}", error="invalid_token"'
                },
            )

        # Token bueno. Lo dejamos a mano para las rutas:
        # `from flask import g`  ->  `g.usuario`
        g.usuario = usuario
        logger.debug("Acceso permitido a %s para %s", endpoint, usuario.username)

        # Registramos el acceso correcto. Esto genera MUCHO mas trafico que los
        # rechazos (uno por cada peticion, no solo por cada intento fallido),
        # asi que se puede apagar con PUBLICAR_ACCESOS_PERMITIDOS=false.
        # Ponerlo en `false` es lo habitual en produccion: los rechazos se
        # guardan siempre, porque de verdad interesa saber quien no pudo entrar.
        if current_app.config.get("PUBLICAR_ACCESOS_PERMITIDOS", True):
            _publicar(
                eventos.TOPIC_SEGURIDAD,
                eventos.evento_acceso_permitido(
                    endpoint, metodo, ip, usuario.username, usuario.roles_ordenados
                ),
            )
        return None


def requiere_rol(*roles_requeridos: str) -> Callable[[F], F]:
    """Decorador que exige uno de los roles indicados.

    Se usa ASI, encima del `@app.route`:

        @app.get("/api/v1/pedidos")
        @requiere_rol("KITCHEN_OPERATOR", "ADMIN")
        def listar_pedidos(): ...

    Bastante con UNO de los roles. Si el usuario no tiene ninguno, se
    responde 403 y se publica el evento en Kafka.
    """

    def envoltura(funcion: F) -> F:
        @wraps(funcion)
        def interna(*args: Any, **kwargs: Any) -> Any:
            # Puede pasar que el middleware este apagado: en ese caso no hay
            # `g.usuario` y no hay nada que comprobar.
            usuario: Usuario | None = getattr(g, "usuario", None)
            if usuario is None:
                return funcion(*args, **kwargs)

            if usuario.tiene_algun_rol(roles_requeridos):
                return funcion(*args, **kwargs)

            endpoint, metodo, ip = _datos_de_la_peticion()
            logger.warning(
                "Acceso denegado a %s para %s (tenia %s, se pedia %s)",
                endpoint,
                usuario.username,
                usuario.roles_ordenados,
                list(roles_requeridos),
            )
            _publicar(
                eventos.TOPIC_SEGURIDAD,
                eventos.evento_acceso_denegado(
                    endpoint,
                    metodo,
                    ip,
                    usuario.username,
                    usuario.roles_ordenados,
                    list(roles_requeridos),
                ),
            )
            return _respuesta_error(
                403,
                "sin_permisos",
                f"Esta ruta necesita uno de estos roles: {', '.join(roles_requeridos)}.",
            )

        return interna  # type: ignore[return-value]

    return envoltura


def registrar_app(app: Flask) -> Flask:
    """Atajo que configura la aplicacion y engancha el middleware de una vez."""
    app.config["AUTH_HABILITADO"] = config.keycloak.habilitado
    app.config["RUTAS_SIN_AUTENTICAR"] = list(config.servicio.versiones_sin_autenticar)
    app.config["PUBLICAR_ACCESOS_PERMITIDOS"] = config.servicio.publicar_accesos_permitidos
    registrar_middleware(app)
    return app
