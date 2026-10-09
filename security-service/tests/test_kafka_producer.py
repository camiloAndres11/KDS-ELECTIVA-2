"""Pruebas de `kafka_producer`, el modulo que publica eventos."""

from __future__ import annotations

import datetime
import json
import re

import pytest

import kafka_producer
from kafka_producer import ahora_iso, publicar_evento
from tests.conftest import ProductorFalso

# Formato ISO 8601 en UTC, por ejemplo 2026-09-29T18:04:05.123456Z
FORMATO_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$")


def test_agrega_timestamp_y_servicio(productor_falso) -> None:
    """Todo evento debe llevar cuando ocurrio y quien lo envio."""
    productor = productor_falso()

    assert publicar_evento("seguridad.accesos", {"tipo": "acceso_sin_token"}) is True

    topic, evento = productor.enviados[0]
    assert topic == "seguridad.accesos"
    assert FORMATO_ISO.match(evento["timestamp"]), f"timestamp con formato raro: {evento['timestamp']}"
    assert evento["servicio"]
    assert evento["tipo"] == "acceso_sin_token"


def test_no_modifica_el_diccionario_original(productor_falso) -> None:
    """No debemos anadir claves al diccionario que nos paso el llamador.

    Si lo hicieramos, el codigo que lo construyo se encontraria campos
    que no puso, y reaparecerian duplicados en la peticion siguiente.
    """
    productor_falso()
    original = {"tipo": "acceso_permitido", "usuario": "cocina"}
    copia = dict(original)

    publicar_evento("seguridad.accesos", original)

    assert original == copia, "publicar_evento modifico el diccionario del llamador"


def test_respeta_un_timestamp_puesto_por_el_llamador(productor_falso) -> None:
    """`setdefault` significa: si el llamador ya puso timestamp, se respeta."""
    productor = productor_falso()
    fijo = "2020-01-01T00:00:00.000000Z"

    publicar_evento("seguridad.accesos", {"tipo": "x", "timestamp": fijo})

    assert productor.enviados[0][1]["timestamp"] == fijo


def test_no_bloquea_la_peticion_esperando_a_kafka(productor_falso) -> None:
    """S3: publicar no hace `flush` (eso lo hace `cerrar_producer` al apagar)."""
    productor = productor_falso()

    publicar_evento("seguridad.accesos", {"tipo": "x"})

    assert productor.flusheos == 0


def test_con_kafka_caido_no_reintenta_en_cada_peticion(monkeypatch: pytest.MonkeyPatch) -> None:
    """S3: tras un fallo de conexion se espera antes de volver a intentar."""
    intentos = []

    def conectar_falla():
        intentos.append(1)
        raise RuntimeError("NoBrokersAvailable (simulado)")

    monkeypatch.setattr(kafka_producer, "_producer", None)
    monkeypatch.setattr(kafka_producer, "_ultimo_fallo_conexion", float("-inf"))
    monkeypatch.setattr(kafka_producer, "_crear_producer", conectar_falla)
    monkeypatch.setenv("KAFKA_HABILITADO", "true")
    from config import recargar_configuracion

    recargar_configuracion()

    assert kafka_producer.obtener_producer() is None
    assert kafka_producer.obtener_producer() is None
    assert len(intentos) == 1


def test_devuelve_false_si_no_hay_conexion(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sin Kafka no se lanza una excepcion: solo se avisa devolviendo False."""
    monkeypatch.setattr(kafka_producer, "obtener_producer", lambda: None)

    assert publicar_evento("seguridad.accesos", {"tipo": "acceso_sin_token"}) is False


def test_devuelve_false_si_kafka_falla(productor_falso) -> None:
    """Un error de Kafka tampoco debe tumbar la peticion del usuario."""
    productor_falso(fallar=True)

    assert publicar_evento("seguridad.accesos", {"tipo": "acceso_sin_token"}) is False


def test_cerrar_producer_es_idempotente(monkeypatch: pytest.MonkeyPatch) -> None:
    """Cerrar dos veces no debe dar error (pasa al apagar el proceso)."""
    productor = ProductorFalso()
    monkeypatch.setattr(kafka_producer, "_producer", productor)

    kafka_producer.cerrar_producer()
    kafka_producer.cerrar_producer()

    assert productor.cerrado is True
    assert kafka_producer._producer is None


def test_ahora_iso_es_una_fecha_valida() -> None:
    assert FORMATO_ISO.match(ahora_iso())


def test_el_evento_se_puede_convertir_en_json(productor_falso) -> None:
    """El serializador real usa `default=str`: una fecha se vuelve texto,
    en vez de romper el envio entero."""
    productor = productor_falso()

    publicar_evento("pedidos.eventos", {"tipo": "pedido_creado", "fecha": datetime.date(2026, 9, 29)})

    _topic, evento = productor.enviados[0]
    texto = json.dumps(evento, default=str)
    assert json.loads(texto)["fecha"] == "2026-09-29"
