"""Pruebas de `config`: la lectura de la configuracion.

Estas pruebas comprueban una cosa importante: que un valor mal escrito
(por ejemplo KAFKA_HABILITADO=quiza) no rompa el arranque, sino que caiga
en el valor por defecto.
"""

from __future__ import annotations

import os

import pytest

import config as modulo_config
from config import obtener_configuracion, recargar_configuracion


@pytest.fixture(autouse=True)
def _limpiar_cache():
    """Cada test empieza y termina con la configuracion recargada."""
    recargar_configuracion()
    yield
    recargar_configuracion()


def test_valores_por_defecto_razonables() -> None:
    configuracion = obtener_configuracion()

    assert configuracion.kafka.servidores == ["localhost:9092"]
    assert configuracion.keycloak.realm == "kds"
    assert configuracion.keycloak.client_id == "kds-api"
    assert configuracion.servicio.puerto == 5000


def test_urls_de_keycloak_se_construyen_solas() -> None:
    """El emisor y la URL de las llaves se deducen de la URL y el realm.
    Asi no hay que repetir la misma informacion en tres sitios distintos."""
    configuracion = obtener_configuracion()

    assert configuracion.keycloak.emisor == "http://localhost:8080/realms/kds"
    assert configuracion.keycloak.url_jwks.endswith("/protocol/openid-connect/certs")


def test_la_url_de_keycloak_no_puede_acabar_en_barra(monkeypatch) -> None:
    """Si el usuario pone la barra final, `issuer` saldria con `//realms` y
    ningun token casaria."""
    monkeypatch.setenv("KEYCLOAK_URL", "http://localhost:9999/")
    recargar_configuracion()

    assert obtener_configuracion().keycloak.emisor == "http://localhost:9999/realms/kds"


def test_varios_brokers_separados_por_coma(monkeypatch) -> None:
    monkeypatch.setenv("KAFKA_BOOTSTRAP_SERVERS", " kafka1:9092 , kafka2:9092 ,, ")
    recargar_configuracion()

    configuracion = obtener_configuracion()
    assert configuracion.kafka.servidores == ["kafka1:9092", "kafka2:9092"]
    assert configuracion.kafka.bootstrap_servers == "kafka1:9092,kafka2:9092"


@pytest.mark.parametrize(
    ("escrito", "esperado"),
    [
        ("true", True),
        ("TRUE", True),
        ("1", True),
        ("si", True),
        ("false", False),
        ("0", False),
        ("no", False),
        # Esto NO es un booleano: usamos el valor por defecto.
        ("quiza", True),
        ("", True),
    ],
)
def test_booleanos_aceptan_varias_formas(monkeypatch, escrito, esperado) -> None:
    monkeypatch.setenv("AUTH_HABILITADO", escrito)
    recargar_configuracion()

    assert obtener_configuracion().keycloak.habilitado is esperado


def test_audiencia_vacia_se_trata_como_ausente(monkeypatch) -> None:
    """Sin audiencia, la comprobacion de `aud` se desactiva."""
    monkeypatch.setenv("KEYCLOAK_AUDIENCE", "   ")
    recargar_configuracion()

    assert obtener_configuracion().keycloak.audience is None


def test_el_proxy_de_config_ve_los_cambios(monkeypatch) -> None:
    """`config` debe reflejar siempre la configuracion vigente, no la del
    momento en que se importo el modulo."""
    from config import config

    assert config.kafka.servidores == ["localhost:9092"]
    monkeypatch.setenv("KAFKA_BOOTSTRAP_SERVERS", "otro:9092")
    recargar_configuracion()
    assert config.kafka.servidores == ["otro:9092"]


def test_la_configuracion_es_de_solo_lectura() -> None:
    """`frozen=True` impide que alguien cambie un valor por error en caliente."""
    configuracion = obtener_configuracion()

    with pytest.raises(Exception):
        configuracion.servicio.puerto = 9999  # type: ignore[misc]


def test_no_se_guardan_secretos_en_el_codigo() -> None:
    """Ninguna contrasena debe estar escrita dentro de un archivo .py.

    Los secretos se leen siempre del entorno (config.py). Si este test falla,
    alguien dejo una clave metida en el codigo y acabaria en el repositorio.
    """
    import re
    from pathlib import Path

    raiz = Path(modulo_config.__file__).resolve().parent
    # `password = "algo"` con un valor de verdad (no una llamada a os.environ).
    patron = re.compile(r"""(?i)\b(password|secret|clave)\b\s*=\s*["'][^"']+["']""")

    for archivo in raiz.rglob("*.py"):
        if ".venv" in archivo.parts or archivo.name == os.path.basename(__file__):
            continue
        assert not patron.search(archivo.read_text(encoding="utf-8")), (
            f"{archivo.name} parece tener una clave escrita en el codigo"
        )
