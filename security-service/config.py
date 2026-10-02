"""Lectura de la configuracion del servicio de seguridad.

Regla de oro: los valores sensibles (contrasenas, secretos) NUNCA se escriben
dentro del codigo. Se leen del entorno o de un archivo `.env` que esta en el
`.gitignore`.

Para usar este modulo:

    from config import config
    print(config.kafka.servidores)
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Carpeta donde vive este servicio (security-service/).
RAIZ_SERVICIO = Path(__file__).resolve().parent

# Carga el archivo .env si existe. Si no existe, no pasa nada:
# se seguiran usando las variables de entorno del sistema.
load_dotenv(RAIZ_SERVICIO / ".env")

# Valores por defecto pensados para trabajar en local con Docker.
SERVIDOR_KAFKA_POR_DEFECTO = "localhost:9092"
# Keycloak ya ocupa el 8080, asi que este servicio usa el 5000 (el de Flask).
PUERTO_SERVICIO_POR_DEFECTO = 5000
PUERTO_KEYCLOAK_POR_DEFECTO = 8080
REALM_POR_DEFECTO = "kds"
CLIENT_ID_POR_DEFECTO = "kds-api"


def _texto(nombre: str, por_defecto: str = "") -> str:
    """Lee una variable de entorno de tipo texto."""
    return (os.environ.get(nombre) or por_defecto).strip()


def _booleano(nombre: str, por_defecto: bool = False) -> bool:
    """Lee una variable de entorno que representa un si/no.

    Acepta varias formas de escribirlo porque es facil equivocarse:
    `1`, `true`, `t`, `yes`, `si` son SI. `0`, `false`, `f`, `no` son NO.
    """
    valor = (os.environ.get(nombre) or "").strip().lower()
    if valor in {"1", "true", "t", "yes", "y", "si", "sí"}:
        return True
    if valor in {"0", "false", "f", "no", "n"}:
        return False
    return por_defecto


def _lista_de_servidores(nombre: str, por_defecto: str) -> list[str]:
    """Convierte `a:9092,b:9092` en `["a:9092", "b:9092"]`.

    Kafka acepta varios brokers separados por coma. Quitamos espacios
    sobrantes y las entradas vacias para no mandarle basura.
    """
    crudo = os.environ.get(nombre) or por_defecto
    return [parte.strip() for parte in crudo.split(",") if parte.strip()]


@dataclass(frozen=True)
class ConfiguracionKafka:
    """Como conectarse al broker de Kafka."""

    servidores: list[str]
    cliente_id: str
    habilitado: bool
    segundos_espera_envio: float

    @property
    def bootstrap_servers(self) -> str:
        """Valor en el formato que espera la libreria `kafka-python`."""
        return ",".join(self.servidores)


@dataclass(frozen=True)
class ConfiguracionKeycloak:
    """Datos del servidor de identidad (Keycloak)."""

    url: str
    realm: str
    client_id: str
    audience: str | None
    habilitado: bool
    segundos_espera_jwks: float

    @property
    def emisor(self) -> str:
        """`issuer` del token. Keycloak lo exige para saber de quien es el token."""
        return f"{self.url}/realms/{self.realm}"

    @property
    def url_jwks(self) -> str:
        """Direccion donde Keycloak publica las llaves publicas con las que
        firma los tokens. El servicio la descarga una vez y la guarda en memoria."""
        return f"{self.emisor}/protocol/openid-connect/certs"


@dataclass(frozen=True)
class ConfiguracionServicio:
    """Ajustes generales del servicio Flask."""

    nombre: str
    puerto: int
    nivel_log: str
    versiones_sin_autenticar: list[str]
    publicar_accesos_permitidos: bool


@dataclass(frozen=True)
class Configuracion:
    """Agrupa las tres partes para tener un solo punto de entrada."""

    kafka: ConfiguracionKafka
    keycloak: ConfiguracionKeycloak
    servicio: ConfiguracionServicio


def _construir_configuracion() -> Configuracion:
    url_keycloak = _texto("KEYCLOAK_URL", f"http://localhost:{PUERTO_KEYCLOAK_POR_DEFECTO}").rstrip("/")
    realm = _texto("KEYCLOAK_REALM", REALM_POR_DEFECTO)
    client_id = _texto("KEYCLOAK_CLIENT_ID", CLIENT_ID_POR_DEFECTO)

    return Configuracion(
        kafka=ConfiguracionKafka(
            servidores=_lista_de_servidores("KAFKA_BOOTSTRAP_SERVERS", SERVIDOR_KAFKA_POR_DEFECTO),
            cliente_id=_texto("KAFKA_CLIENT_ID", "kds-security-service"),
            habilitado=_booleano("KAFKA_HABILITADO", True),
            segundos_espera_envio=float(_texto("KAFKA_SEGUNDOS_ESPERA", "5")),
        ),
        keycloak=ConfiguracionKeycloak(
            url=url_keycloak,
            realm=realm,
            client_id=client_id,
            # Si no se define, no se revisa la audiencia del token.
            audience=_texto("KEYCLOAK_AUDIENCE") or None,
            habilitado=_booleano("AUTH_HABILITADO", True),
            segundos_espera_jwks=float(_texto("KEYCLOAK_SEGUNDOS_ESPERA_JWKS", "5")),
        ),
        servicio=ConfiguracionServicio(
            nombre=_texto("NOMBRE_SERVICIO", "kds-security-service"),
            puerto=int(_texto("PUERTO", str(PUERTO_SERVICIO_POR_DEFECTO))),
            nivel_log=_texto("LOG_LEVEL", "INFO").upper(),
            versiones_sin_autenticar=[
                ruta.strip()
                for ruta in _texto("RUTAS_SIN_AUTENTICAR", "/,/health").split(",")
                if ruta.strip()
            ],
            # Un evento por cada peticion con token valido. Da mucho mas trafico
            # que los rechazos, asi que en produccion normalmente se apaga.
            publicar_accesos_permitidos=_booleano("PUBLICAR_ACCESOS_PERMITIDOS", True),
        ),
    )


@lru_cache(maxsize=1)
def obtener_configuracion() -> Configuracion:
    """Devuelve la configuracion ya leida.

    `lru_cache` hace que se lea del entorno UNA sola vez, aunque se llame
    muchas veces. Asi todas las partes del programa ven los mismos valores.
    """
    return _construir_configuracion()


def recargar_configuracion() -> None:
    """Vuelve a leer el entorno. Sirve para las pruebas automaticas."""
    obtener_configuracion.cache_clear()


class _ConfigActual:
    """Envoltorio que siempre mira la configuracion vigente.

    Si hicieramos `config = obtener_configuracion()`, el objeto quedaria
    congelado en el momento de importarlo y `recargar_configuracion()` no
    tendria efecto. Con este envoltorio `config.kafka.servidores` siempre
    lee el valor mas reciente.
    """

    def __getattr__(self, nombre: str) -> object:
        return getattr(obtener_configuracion(), nombre)

    def __repr__(self) -> str:
        return repr(obtener_configuracion())


# Atajo para usar `from config import config` y ya tener el objeto listo.
config = _ConfigActual()
