"""Servicio de Keycloak: valida el token y devuelve el usuario.

Que es un token JWT
------------------
Keycloak no guarda una sesion en el servidor: entrega un texto llamado token
(las tres partes separadas por punto son cabecera, contenido y firma). El
servidor de Keycloak se queda con la llave PRIVADA; el servicio de la
aplicacion descarga la llave PUBLICA y con ella comprueba que la firma sea
autentica, sin preguntarle nada a Keycloak en cada peticion.

Que revisamos del token
----------------------
- La firma digital (que sea de verdad de nuestro Keycloak y que no este alterado).
- `exp`: que no haya caducado.
- `iss` (emisor): que pertenezca a este realm. Asi el token de otro Keycloak
  no nos sirve.
- `aud` (audiencia): solo si se configura KEYCLOAK_AUDIENCE. Con el cliente
  publico de ejemplo, Keycloak pone `aud=account`, asi que se deja opcional.
- Los roles, que despues usa el middleware para autorizar.

Arquitectura en capas
---------------------
    middleware  -> llama a  ->  este modulo
                              |
                              +-> devuelve un `Usuario` o lanza `TokenInvalidoError`
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import Any

import jwt
from jwt import PyJWKClient

from config import config

logger = logging.getLogger(__name__)

# Algoritmos que aceptamos. Se lista de forma explicita (y no "RS256,HS256,...")
# porque accepting the algorithm None / none is a classic JWT vulnerability:
# un atacante podria cambiar el algoritmo del token y hacer que se acepte sin
# firma. Con una lista cerrada, solo se acepta RS256.
ALGORITMOS_ACEPTADOS = ["RS256"]

# Mensajes de PyJWT que se traducen a un motivo entendible para el operador.
MOTIVOS_AMIGABLES = {
    "ExpiredSignatureError": "token_caducado",
    "InvalidAudienceError": "audiencia_no_valida",
    "InvalidIssuerError": "emisor_no_valido",
    "InvalidSignatureError": "firma_invalida",
    "InvalidTokenError": "token_mal_formado",
    "ImmatureSignatureError": "token_aun_no_valido",
}


class TokenInvalidoError(Exception):
    """El token no sirve. Lleva un `motivo` corto para el evento de Kafka.

    No se registra el token aqui a proposito: los tokens son credenciales y
    escribirlos en el log seria filtrarlas.
    """

    def __init__(self, motivo: str, detalle: str | None = None) -> None:
        super().__init__(detalle or motivo)
        self.motivo = motivo
        self.detalle = detalle


class KeycloakNoDisponibleError(TokenInvalidoError):
    """Keycloak no respondio: el token puede ser bueno, el problema es NUESTRO (503, no 401)."""

    def __init__(self, detalle: str | None = None) -> None:
        super().__init__("keycloak_no_disponible", detalle)


@dataclass(frozen=True)
class Usuario:
    """La persona que hizo la peticion, segun lo que dice su token."""

    id: str
    username: str
    email: str | None
    nombres: str | None
    roles: frozenset[str] = field(default_factory=frozenset)
    claims: dict[str, Any] = field(default_factory=dict)

    def tiene_algun_rol(self, roles_requeridos: "list[str] | tuple[str, ...] | set[str]") -> bool:
        """Devuelve True si tiene al menos UNO de los roles pedidos."""
        return bool(self.roles.intersection(roles_requeridos))

    @property
    def roles_ordenados(self) -> list[str]:
        """Roles como lista ordenada: se imprime siempre igual, facilita los tests."""
        return sorted(self.roles)


# PyJWKClient descarga el JWKS y lo guarda en memoria. Lo creamos una sola vez:
# `PyJWKClient` ya trae su propia cache y refresca si ve una llave nueva.
_cliente_jwks: PyJWKClient | None = None
_candado_jwks = threading.Lock()

# Segundos que se considera valida una llave publica cacheada (1 hora).
# Si Keycloak rota las llaves, el cliente las vuelve a pedir pasado este tiempo.
SEGUNDOS_CACHE_JWKS = 3600


def obtener_cliente_jwks() -> PyJWKClient:
    """Devuelve el cliente que sabe donde estan las llaves publicas de Keycloak."""
    global _cliente_jwks
    if _cliente_jwks is None:
        with _candado_jwks:
            if _cliente_jwks is None:
                _cliente_jwks = PyJWKClient(
                    config.keycloak.url_jwks,
                    cache_keys=True,
                    lifespan=SEGUNDOS_CACHE_JWKS,
                    timeout=config.keycloak.segundos_espera_jwks,
                )
    return _cliente_jwks


def limpiar_cliente_jwks() -> None:
    """Olvida la llave publica cacheada. Se usa si se rota la llave de Keycloak."""
    global _cliente_jwks
    _cliente_jwks = None


def _parece_error_de_conexion(error: Exception) -> bool:
    """Distingue "Keycloak no responde" de "esta llave no la conozco".

    Keycloak apagado o sin red es un problema del SERVIDOR (hay que avisar).
    Una llave desconocida es un problema del CLIENTE (puede ser un ataque).
    """
    # Los errores de red de la libreria que usa PyJWKClient.
    try:
        from jwt import PyJWKClientConnectionError
    except ImportError:  # pragma: no cover - versiones antiguas de PyJWT
        return False
    if isinstance(error, PyJWKClientConnectionError):
        return True
    # Fallo de DNS o de socket envuelto en otro tipo de excepcion.
    return isinstance(error, (ConnectionError, TimeoutError, OSError))


def _extraer_roles(claims: dict[str, Any]) -> frozenset[str]:
    """Junta los roles que trae el token en dos sitios distintos.

    Keycloak separa los roles en:
    - `realm_access.roles`               -> roles de TODO el realm.
    - `resource_access.<cliente>.roles` -> roles de UN cliente concreto.

    Nos interesan los dos: asi el servicio no depende de como el usuario
    haya recibido el rol.
    """
    roles: set[str] = set()

    acceso_realm = claims.get("realm_access")
    if isinstance(acceso_realm, dict):
        for rol in acceso_realm.get("roles", []) or []:
            if isinstance(rol, str):
                roles.add(rol)

    acceso_recursos = claims.get("resource_access")
    if isinstance(acceso_recursos, dict):
        # Nos fijamos solo en nuestro cliente, no en todos.
        del_cliente = acceso_recursos.get(config.keycloak.client_id)
        if isinstance(del_cliente, dict):
            for rol in del_cliente.get("roles", []) or []:
                if isinstance(rol, str):
                    roles.add(rol)

    # Quitamos los roles que Keycloak mete por defecto, que no son permisos
    # de negocio y solo ensuciarian el evento de Kafka.
    roles.discard("offline_access")
    roles.discard("uma_authorization")
    return frozenset(roles)


def _construir_usuario(claims: dict[str, Any]) -> Usuario:
    """Convierte el contenido del token (ya verificado) en un `Usuario`."""
    return Usuario(
        id=str(claims.get("sub", "")),
        username=str(claims.get("preferred_username") or claims.get("username") or "desconocido"),
        email=claims.get("email"),
        nombres=claims.get("name") or claims.get("given_name"),
        roles=_extraer_roles(claims),
        claims=claims,
    )


def verificar_token(token: str) -> Usuario:
    """Valida un token y devuelve el usuario.

    Argumentos:
        token: el texto del token SIN la palabra "Bearer".

    Devuelve:
        Un `Usuario` si todo esta bien.

    Lanza:
        TokenInvalidoError: si el token esta mal formado, caducado, mal firmado
        o es de otro emisor. El `motivo` sirve para el evento de Kafka.
    """
    if not token or not token.strip():
        raise TokenInvalidoError("token_vacio")

    # 1) ¿Es siquiera un JWT? Solo miramos la cabecera, SIN verificar la firma.
    #    Asi distinguimos "el cliente mando basura" de "la llave no la conozco",
    #    que en el evento de Kafka son dos cosas muy distintas.
    try:
        jwt.get_unverified_header(token)
    except jwt.PyJWTError as error:
        raise TokenInvalidoError("token_mal_formado") from error

    cliente = obtener_cliente_jwks()
    # 2) Descargar la llave publica con la que Keycloak firmo ESTE token.
    #    `kid` es el identificador de la llave dentro de la cabecera del token.
    try:
        llave = cliente.get_signing_key_from_jwt(token)
    except Exception as error:  # noqa: BLE001
        # Si Keycloak esta apagado o no responde, NO es lo mismo que una
        # llave desconocida: lo decimos distinto para poder verlo en el panel.
        if _parece_error_de_conexion(error):
            raise KeycloakNoDisponibleError(str(error)) from error
        raise TokenInvalidoError("llave_no_encontrada", str(error)) from error

    # 2) Verificar firma y contenido.
    opciones = {
        # Sin esto, PyJWT exigiria que el token traiga el claim `aud`.
        # Como el cliente de ejemplo es publico, lo dejamos opcional.
        "verify_aud": config.keycloak.audience is not None,
    }
    try:
        claims = jwt.decode(
            token,
            llave.key,
            algorithms=ALGORITMOS_ACEPTADOS,
            audience=config.keycloak.audience,
            issuer=config.keycloak.emisor,
            options=opciones,
        )
    except jwt.ExpiredSignatureError as error:
        raise TokenInvalidoError("token_caducado") from error
    except jwt.PyJWTError as error:
        # Traducimos el nombre de la excepcion a algo legible.
        motivo = MOTIVOS_AMIGABLES.get(type(error).__name__, "token_no_valido")
        raise TokenInvalidoError(motivo) from error
    except Exception as error:  # noqa: BLE001 - por ejemplo, Keycloak apagado
        raise KeycloakNoDisponibleError(str(error)) from error

    usuario = _construir_usuario(claims)
    logger.debug("Token verificado para '%s' con roles %s", usuario.username, usuario.roles_ordenados)
    return usuario
