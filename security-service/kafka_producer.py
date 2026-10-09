"""Modulo productor de eventos hacia Kafka (libreria `kafka-python`).

Este es el corazon de la "administracion de eventos" del documento.

La idea es sencilla: el resto del codigo NUNCA habla con Kafka directamente.
Llama a una sola funcion:

    from kafka_producer import publicar_evento
    publicar_evento("seguridad.accesos", {"tipo": "acceso_sin_token"})

Y este modulo se encarga de la conexion, del formato JSON y de los errores.

Decisiones de diseno (importantes para entender el codigo):

1. La conexion se crea LA PRIMERA VEZ que se necesita (y no al importar el
   archivo). Si Kafka esta caido, la aplicacion igual arranca y solo deja de
   registrar eventos. Un problema de observabilidad jamas debe tumbar el
   servicio principal.
2. `publicar_evento` nunca lanza una excepcion. Un error de Kafka se guarda
   en el log y se sigue. Perder un evento es malo, tumbar la API es peor.
3. Devuelve `True` si se publico y `False` si no, para que quien llame pueda
   saberlo (por ejemplo, en las pruebas).
"""

from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Any

from kafka import KafkaProducer

from config import config

# `logger` es la forma correcta de registrar mensajes en Python.
# Nunca usamos `print` en codigo de produccion.
logger = logging.getLogger(__name__)

# La conexion viva de Kafka. `None` significa "todavia no hemos conectado".
_producer: KafkaProducer | None = None

# Flask atiende varias peticiones al mismo tiempo (hilos). El candado evita que
# dos hilos intenten abrir la conexion al mismo tiempo y creen dos productores.
_candado_conexion = threading.Lock()

# Si Kafka esta caido, no reintentamos conectar en CADA peticion (cada intento
# bloquea varios segundos): esperamos este tiempo desde el ultimo fallo.
# ponytail: con Kafka caido, UNA peticion cada 30 s paga KAFKA_SEGUNDOS_ESPERA al reintentar;
# conectar en un hilo aparte si eso llega a molestar.
SEGUNDOS_ENTRE_REINTENTOS = 30
_ultimo_fallo_conexion = float("-inf")

# Formato de fecha comun para todos los eventos.
# `datetime.now(timezone.utc)` es preferible a `datetime.utcnow()` porque
# `utcnow()` esta obsoleto desde Python 3.12 y devuelve una fecha sin zona horaria.
FORMATO_FECHA = "%Y-%m-%dT%H:%M:%S.%fZ"


def ahora_iso() -> str:
    """Devuelve la hora actual en UTC con formato ISO 8601.

    Todos los eventos llevan esta marca de tiempo, asi se pueden ordenar en el
    tiempo aunque lleguen desordenados.
    """
    return datetime.now(timezone.utc).strftime(FORMATO_FECHA)


def _crear_producer() -> KafkaProducer:
    """Abre la conexion con Kafka.

    `value_serializer` es la pieza clave: la libreria entrega los mensajes como
    `bytes`, y nosotros le pasamos diccionarios de Python. El serializador se
    encarga de convertirlos a JSON y a bytes UTF-8 automaticamente.
    """
    configuracion = config.kafka
    logger.info(
        "Conectando a Kafka en %s (cliente: %s)",
        configuracion.bootstrap_servers,
        configuracion.cliente_id,
    )
    return KafkaProducer(
        bootstrap_servers=configuracion.servidores,
        client_id=configuracion.cliente_id,
        value_serializer=lambda valor: json.dumps(valor, default=str).encode("utf-8"),
        # `acks="all"` espera confirmacion de TODAS las replicas. Es lo que
        # necesita la libreria para activar el modo idempotente, que evita
        # duplicados si la conexion se cae justo despues de enviar.
        # OJO: poner `acks=1` aqui desactiva ese modo (Kafka avisa por log),
        # asi que los dos valores van juntos.
        acks="all",
        enable_idempotence=True,
        # Si Kafka no responde, no nos quedamos colgados esperando.
        request_timeout_ms=int(configuracion.segundos_espera_envio * 1000),
        max_block_ms=int(configuracion.segundos_espera_envio * 1000),
        # kafka-python 3.x espera 30 s por defecto el primer contacto con el broker.
        bootstrap_timeout_ms=int(configuracion.segundos_espera_envio * 1000),
        # Reconectar solo si el broker estaba arriba y se cae.
        retries=3,
    )


def obtener_producer() -> KafkaProducer | None:
    """Devuelve el productor, creandolo si hace falta. `None` si no se pudo.

    Se separa en su propia funcion para que las pruebas puedan reemplazar la
    conexion por una falsa.
    """
    global _producer, _ultimo_fallo_conexion

    if not config.kafka.habilitado:
        logger.debug("Kafka esta deshabilitado (KAFKA_HABILITADO=false); no se publica.")
        return None

    if _producer is not None:
        return _producer

    with _candado_conexion:
        # Segundo `if`: otro hilo pudo conectarse mientras esperabamos el candado.
        if _producer is not None:
            return _producer
        if time.monotonic() - _ultimo_fallo_conexion < SEGUNDOS_ENTRE_REINTENTOS:
            return None
        try:
            _producer = _crear_producer()
        except Exception as error:  # noqa: BLE001 - aqui si queremos ver cualquier fallo
            _ultimo_fallo_conexion = time.monotonic()
            logger.error(
                "No se pudo conectar a Kafka: %s (reintento en %ss)", error, SEGUNDOS_ENTRE_REINTENTOS
            )
            return None

    return _producer


def cerrar_producer() -> None:
    """Cierra la conexion. Hay que llamarlo al apagar el servicio."""
    global _producer
    if _producer is not None:
        try:
            _producer.flush(timeout=config.kafka.segundos_espera_envio)
            _producer.close(timeout=config.kafka.segundos_espera_envio)
            logger.info("Conexion con Kafka cerrada.")
        except Exception as error:  # noqa: BLE001
            logger.warning("Error al cerrar Kafka: %s", error)
        finally:
            _producer = None


def publicar_evento(topic: str, evento: dict[str, Any]) -> bool:
    """Envia un evento a un topic de Kafka.

    Argumentos:
        topic: nombre del topic, por ejemplo "seguridad.accesos".
        evento: diccionario con los datos del evento. Se le anade
                automaticamente la marca de tiempo y el nombre del servicio.

    Devuelve:
        True si el evento quedo en cola para enviarse, False si no (Kafka caido
        o deshabilitado). El envio es asincrono: la peticion del usuario NO
        espera a Kafka. Si el envio falla despues, se registra en el log.

    Nunca lanza una excepcion: el objetivo es que un problema de Kafka no
    Rompa la peticion que el usuario esta haciendo.
    """
    # Copiamos el diccionario para no modificar el que recibio el llamador.
    cuerpo: dict[str, Any] = dict(evento)
    cuerpo.setdefault("timestamp", ahora_iso())
    cuerpo.setdefault("servicio", config.servicio.nombre)

    try:
        producer = obtener_producer()
        if producer is None:
            return False

        # `send` es asincrono: deja el evento en el buffer y vuelve enseguida.
        # No hacemos `flush` aqui (bloquearia cada peticion hasta que Kafka
        # confirme); el buffer se vacia solo, y `cerrar_producer` lo vacia al apagar.
        tipo = cuerpo.get("tipo", "-")
        producer.send(topic, value=cuerpo).add_callback(
            lambda resultado: logger.info(
                "Evento publicado en '%s' (tipo=%s, particion=%s, offset=%s)",
                topic,
                tipo,
                resultado.partition,
                resultado.offset,
            )
        ).add_errback(lambda error: logger.error("Error al publicar en '%s': %s", topic, error))
        return True

    except Exception as error:  # noqa: BLE001 - ver la nota del docstring
        logger.error("Error al publicar en '%s': %s", topic, error)
        return False
