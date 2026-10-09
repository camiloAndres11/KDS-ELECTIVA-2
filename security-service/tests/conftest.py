"""Herramientas compartidas por las pruebas.

La idea es NO necesitar ni Kafka ni Keycloak para correr las pruebas:
se generan una llave y un token falsos en memoria, y se sustituyen las
conexiones por dobles de prueba.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

import keycloak_service
from config import config

# Identificador de la llave falsa. El token lo lleva en la cabecera (`kid`),
# igual que haria Keycloak.
KID_DE_PRUEBAS = "llave-de-pruebas-01"


@pytest.fixture(scope="session")
def llave_privada() -> rsa.RSAPrivateKey:
    """Una llave RSA de prueba. La genera cryptography, no hace falta red.

    Se genera una sola vez para todas las pruebas porque RSA es lento.
    """
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def cliente_jwks_falso(monkeypatch: pytest.MonkeyPatch, llave_privada: rsa.RSAPrivateKey) -> None:
    """Sustituye al cliente que descarga las llaves de Keycloak.

    En vez de hacer una peticion HTTP, devuelve la llave publica de nuestra
    llave de prueba. Asi probamos la verificacion REAL del token (firma,
    caducidad, emisor) sin tener que levantar Keycloak.
    """

    class LlaveFalsa:
        key = llave_privada.public_key()

    class ClienteFalso:
        def get_signing_key_from_jwt(self, token: str) -> "LlaveFalsa":
            return LlaveFalsa()

    monkeypatch.setattr(keycloak_service, "obtener_cliente_jwks", lambda: ClienteFalso())


@pytest.fixture
def fabricar_token(llave_privada: rsa.RSAPrivateKey) -> Callable[..., str]:
    """Devuelve una fabrica de tokens: `fabricar_token(roles=["ADMIN"]) -> str`."""

    def fabricar(
        roles: list[str] | None = None,
        usuario: str = "cocina",
        expira_en: int = 300,
        issuer: str | None = None,
        audience: str | None = None,
        cliente_id: str | None = None,
        omitir_issuer: bool = False,
    ) -> str:
        ahora = int(time.time())
        claims: dict[str, Any] = {
            "sub": f"uuid-de-{usuario}",
            "preferred_username": usuario,
            "email": f"{usuario}@kds.local",
            "name": usuario.capitalize(),
            "iat": ahora,
            "exp": ahora + expira_en,
            "realm_access": {"roles": list(roles or [])},
        }
        if not omitir_issuer:
            claims["iss"] = issuer if issuer is not None else config.keycloak.emisor
        if audience:
            claims["aud"] = audience
        if cliente_id:
            claims["resource_access"] = {cliente_id: {"roles": list(roles or [])}}

        return jwt.encode(
            claims,
            llave_privada,
            algorithm="RS256",
            headers={"kid": KID_DE_PRUEBAS},
        )

    return fabricar


# --- Dobles de prueba de Kafka ---------------------------------------------


@dataclass
class ResultadoFalso:
    """Imita el objeto que devuelve la promesa de `producer.send()`."""

    partition: int = 0
    offset: int = 7


class PromesaFalsa:
    """Imita `FutureRecordMetadata`: los callbacks se encadenan."""

    def get(self, timeout: float | None = None) -> ResultadoFalso:
        return ResultadoFalso()

    def add_callback(self, funcion: Callable[..., Any]) -> "PromesaFalsa":
        funcion(ResultadoFalso())
        return self

    def add_errback(self, _funcion: Callable[..., Any]) -> "PromesaFalsa":
        return self


class ProductorFalso:
    """Imita lo justo de `KafkaProducer` que usa nuestro modulo.

    Guardamos lo enviado en una lista para poder comprobarlo en el test.
    """

    def __init__(self, fallar: bool = False) -> None:
        self.enviados: list[tuple[str, dict[str, Any]]] = []
        self.flusheos = 0
        self.cerrado = False
        self.fallar = fallar

    def send(self, topic: str, value: Any = None) -> PromesaFalsa:
        if self.fallar:
            raise RuntimeError("Kafka no responde (simulado)")
        self.enviados.append((topic, value))
        return PromesaFalsa()

    def flush(self, timeout: float | None = None) -> None:
        self.flusheos += 1

    def close(self, timeout: float | None = None) -> None:
        self.cerrado = True


@dataclass
class RegistradorEventos:
    """Guarda los eventos que el codigo intento publicar, para poder mirarlos."""

    eventos: list[tuple[str, dict[str, Any]]] = field(default_factory=list)

    def registrar(self, topic: str, evento: dict[str, Any]) -> bool:
        self.eventos.append((topic, evento))
        return True

    def de_tipo(self, tipo: str) -> list[dict[str, Any]]:
        """Solo los eventos de un tipo concreto."""
        return [evento for _, evento in self.eventos if evento.get("tipo") == tipo]

    @property
    def topics(self) -> list[str]:
        return [topic for topic, _ in self.eventos]


@pytest.fixture
def productor_falso(monkeypatch: pytest.MonkeyPatch) -> Callable[..., ProductorFalso]:
    """Conecta un `ProductorFalso` en lugar de la conexion real de Kafka."""
    import kafka_producer

    def instalar(fallar: bool = False) -> ProductorFalso:
        productor = ProductorFalso(fallar=fallar)
        monkeypatch.setattr(kafka_producer, "obtener_producer", lambda: productor)
        return productor

    return instalar


@pytest.fixture
def registrador_eventos(monkeypatch: pytest.MonkeyPatch) -> RegistradorEventos:
    """Intercepta TODAS las publicaciones de eventos de los tests.

    Sin esto, cada test intentaria conectarse a Kafka de verdad.
    """
    import app
    import keycloak_middleware
    import kafka_producer

    registro = RegistradorEventos()
    monkeypatch.setattr(kafka_producer, "publicar_evento", registro.registrar)
    monkeypatch.setattr(keycloak_middleware, "publicar_evento", registro.registrar)
    monkeypatch.setattr(app, "publicar_evento", registro.registrar)
    return registro
