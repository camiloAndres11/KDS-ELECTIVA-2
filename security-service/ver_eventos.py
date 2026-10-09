"""Script para VER los eventos que hay en Kafka.

Es el "entorno visual" del que habla el documento, pero en consola y sin
depender de kafka-ui. Sirve para comprobar rapido, desde la terminal, que el
servicio esta publicando lo que debe.

Como usarlo:

    python ver_eventos.py                       # todos los topics, 20lineas
    python ver_eventos.py --topic seguridad.accesos
    python ver_eventos.py --max 50
    python ver_eventos.py --contar               # solo resume, sin imprimir
    python ver_eventos.py --desde-inicio         # incluye los eventos viejos

Ojo: este script CONSUME mensajes (los saca del topic). Si lo dejas corriendo
mientras haces pruebas, se lleva los eventos que ibas a consultar.
Kafka recuerda en que numero se quedo cada consumidor (el "offset"), asi que
con --desde-inicio vuelve a leerlos todos.
"""

from __future__ import annotations

import argparse
import itertools
import json
import logging
import sys
from collections import Counter

from kafka import KafkaConsumer
# En kafka-python 3.x el error de "no hay broker" se llama `MetadataEmptyBrokerList`.
# En la 2.x era `NoBrokersAvailable`. Por eso lo buscamos con getattr: asi el
# script funciona con las dos versiones.
from kafka.errors import MetadataEmptyBrokerList

import eventos
from config import config

# Nombre del error segun la version instalada.
ERROR_SIN_BROKER = getattr(
    __import__("kafka.errors", fromlist=["errors"]),
    "NoBrokersAvailable",
    MetadataEmptyBrokerList,
)

logger = logging.getLogger("kds.ver-eventos")


def imprimir_evento(topic: str, valor: bytes) -> None:
    """Muestra un evento de forma legible."""
    try:
        datos = json.loads(valor.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        print(f"[{topic}] (no es JSON) {valor!r}")
        return

    marca = datos.get("timestamp", "-")
    tipo = datos.get("tipo", "-")
    extra = {clave: valor for clave, valor in datos.items() if clave not in {"timestamp", "tipo", "servicio"}}
    print(f"[{marca}] {topic} :: {tipo}")
    print(f"    {json.dumps(extra, ensure_ascii=False, indent=2).replace(chr(10), chr(10) + '    ')}")


def mostrar_resumen(conteo: Counter[str]) -> None:
    """Resumen por tipo de evento."""
    print()
    print("=" * 60)
    print("RESUMEN")
    print("=" * 60)
    if not conteo:
        print("  No llego ningun evento. Comprueba que el servicio este publicando.")
        return
    for tipo, cantidad in conteo.most_common():
        print(f"  {tipo:<22} {cantidad}")
    print("=" * 60)
    print(f"  Total: {sum(conteo.values())}")


def main() -> int:
    analizador = argparse.ArgumentParser(description="Ver los eventos publicados en Kafka.")
    analizador.add_argument(
        "--topic",
        action="append",
        dest="topics",
        help="Topic a leer. Se puede repetir. Por defecto, todos los del servicio.",
    )
    analizador.add_argument(
        "--max",
        type=int,
        default=20,
        help="Numero maximo de eventos a leer (por defecto 20).",
    )
    analizador.add_argument(
        "--contar",
        action="store_true",
        help="Solo muestra el resumen, sin imprimir evento por evento.",
    )
    analizador.add_argument(
        "--desde-inicio",
        action="store_true",
        help="Lee tambien los eventos antiguos, no solo los nuevos.",
    )
    argumentos = analizador.parse_args()

    logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")

    topics = argumentos.topics or list(eventos.TODOS_LOS_TOPICS)
    group_id = None if argumentos.desde_inicio else f"kds-ver-{config.servicio.nombre}"

    print(f"Conectando a Kafka en {config.kafka.bootstrap_servers}...")
    print(f"Topics: {', '.join(topics)}")
    print()

    try:
        consumidor = KafkaConsumer(
            *topics,
            bootstrap_servers=config.kafka.servidores,
            # `None` = sin grupo, lee por posicion y no guarda estado.
            group_id=group_id,
            auto_offset_reset="earliest" if argumentos.desde_inicio else "latest",
            # Sin `value_deserializer` la libreria nos entrega los bytes tal
            # cual, que es justo lo que queremos: asi tambien podemos mostrar
            # los mensajes que no sean JSON.
            consumer_timeout_ms=10_000,
        )
    except ERROR_SIN_BROKER:
        print()
        print("ERROR: no hay ningun broker de Kafka en", config.kafka.bootstrap_servers)
        print("Levantalo con:  docker compose up -d")
        return 1
    except Exception as error:  # noqa: BLE001
        print(f"ERROR al conectar con Kafka: {error}")
        return 1

    conteo: Counter[str] = Counter()
    leidos = 0

    try:
        # `islice` corta ANTES de pedir el mensaje max+1: asi no se consume uno de mas.
        for mensaje in itertools.islice(consumidor, argumentos.max):
            leidos += 1
            try:
                tipo = json.loads(mensaje.value.decode("utf-8")).get("tipo", "(sin tipo)")
            except Exception:  # noqa: BLE001
                tipo = "(no es JSON)"
            conteo[tipo] += 1
            if not argumentos.contar:
                imprimir_evento(mensaje.topic, mensaje.value)
    except KeyboardInterrupt:
        print("\nInterrumpido.")
    finally:
        consumidor.close()

    if leidos == 0 and not argumentos.desde_inicio:
        print("No llego ningun evento nuevo en 10 segundos.")
        print("Prueba con --desde-inicio, o haz una peticion al servicio mientras corre esto.")

    mostrar_resumen(conteo)
    return 0


if __name__ == "__main__":
    sys.exit(main())
