"""Servicio de seguridad del KDS (Flask).

Este es el programa que se ejecuta. Su trabajo es:

1. Exponer algunas rutas de ejemplo.
2. Protegerlas con el middleware de Keycloak.
3. Publicar en Kafka lo que va pasando (la "administracion de eventos").

Como arrancarlo:

    python app.py

Como probarlo:

    # 1. Pedir un token a Keycloak
    curl -X POST http://localhost:8080/realms/kds/protocol/openid-connect/token ^
      -d "client_id=kds-api" -d "grant_type=password" ^
      -d "username=cocina" -d "password=cocina123"

    # 2. Usar ese token
    curl http://localhost:5000/api/v1/pedidos -H "Authorization: Bearer <TOKEN>"
"""

from __future__ import annotations

import atexit
import logging
import time
import uuid

from flask import Flask, g, jsonify, request

import eventos
from config import config
from keycloak_middleware import registrar_app, requiere_rol
from kafka_producer import cerrar_producer, publicar_evento

# El log lleva el prefijo "kds.seguridad" para no mezclarse con los del
# backend Express si alguien tiene los dos servicios arrancados a la vez.
logger = logging.getLogger("kds.seguridad")


def crear_aplicacion() -> Flask:
    """Construye y devuelve la aplicacion Flask.

    Se separa de `main` a proposito: las pruebas pueden llamar a esta funcion
    y obtener una aplicacion limpia sin tener que arrancar el servidor.
    """
    app = Flask(__name__)

    # --- Cronometrado de cada peticion --------------------------------------
    # Guardamos la hora de arranque en `g` (el "bolsillo" de la peticion) y la
    # restamos al responder. Es el primer paso para tener "una vision general
    # de como se esta comportando la aplicacion".
    @app.before_request
    def _marcar_inicio():
        g.inicio_peticion = time.perf_counter()

    @app.after_request
    def registrar_peticion(respuesta):
        inicio = g.get("inicio_peticion")
        if inicio is not None:
            duracion_ms = (time.perf_counter() - inicio) * 1000
            logger.info(
                "%s %s -> %s (%.1f ms)",
                request.method,
                request.path,
                respuesta.status_code,
                duracion_ms,
            )
        return respuesta

    # Enganchamos el middleware de Keycloak ANTES de declarar las rutas,
    # para que proteja a todas ellas.
    registrar_app(app)

    # --- Rutas publicas (no piden token) -----------------------------------

    @app.get("/")
    def inicio():
        """Presenta el servicio. Publica a proposito."""
        return jsonify(
            {
                "servicio": config.servicio.nombre,
                "descripcion": "Administracion de eventos Kafka + middleware de Keycloak",
                "endpoints": {
                    "GET  /health": "publico",
                    "GET  /api/v1/pedidos": "requiere KITCHEN_OPERATOR, DISPATCHER o ADMIN",
                    "POST /api/v1/pedidos": "requiere POS_SYSTEM o ADMIN",
                    "GET  /api/v1/perfil": "cualquier usuario autenticado",
                },
            }
        )

    @app.get("/health")
    def health():
        """Comprobacion de vida. Publica: la usan Docker y los monitores."""
        return jsonify({"estado": "ok", "servicio": config.servicio.nombre})

    # --- Rutas protegidas ---------------------------------------------------

    @app.get("/api/v1/perfil")
    def perfil():
        """Muestra quien es el usuario del token.

        No necesita un rol concreto: con tener un token valido basta.
        Sirve para comprobar que el token se esta leyendo bien.
        """
        usuario = g.usuario
        return jsonify(
            {
                "id": usuario.id,
                "usuario": usuario.username,
                "email": usuario.email,
                "nombres": usuario.nombres,
                "roles": usuario.roles_ordenados,
            }
        )

    @app.get("/api/v1/pedidos")
    @requiere_rol("KITCHEN_OPERATOR", "DISPATCHER", "ADMIN")
    def listar_pedidos():
        """Ruta de la cocina: ver los pedidos activos.

        Se protege con el decorador `@requiere_rol`. El token ya es valido
        (eso lo aseguro el middleware); aqui solo miramos los roles.
        """
        # Aqui viviria la consulta real al backend. Para la clase solo
        # devolvemos datos de ejemplo, pero publicamos el evento de verdad.
        pedidos = [
            {"id": str(uuid.uuid4()), "codigo": "#P-1001", "canal": "DINE_IN", "prioridad": "NORMAL"},
            {"id": str(uuid.uuid4()), "codigo": "#P-1002", "canal": "DELIVERY", "prioridad": "VIP"},
        ]
        return jsonify({"pedidos": pedidos, "total": len(pedidos)})

    @app.post("/api/v1/pedidos")
    @requiere_rol("POS_SYSTEM", "ADMIN")
    def crear_pedido():
        """Ruta del punto de venta: crear un pedido.

        El rol `POS_SYSTEM` es el que debe poder escribir; la cocina solo lee
        (mas arriba). Asi separamos "quien crea" de "quien consulta".
        """
        cuerpo = request.get_json(silent=True) or {}
        codigo = cuerpo.get("codigo") or f"#P-{uuid.uuid4().hex[:4].upper()}"
        canal = cuerpo.get("canal") or "DINE_IN"
        # Un solo id: el del evento y el de la respuesta deben poder cruzarse.
        pedido_id = str(uuid.uuid4())

        # Aqui se llamaria al backend de pedidos para guardarlo de verdad.
        # Registramos el evento para que quede en el historial de Kafka.
        publicar_evento(
            eventos.TOPIC_PEDIDOS,
            eventos.evento_pedido_creado(
                pedido_id=pedido_id,
                codigo=codigo,
                canal=canal,
                usuario=g.usuario.username,
            ),
        )

        return (
            jsonify(
                {
                    "id": pedido_id,
                    "codigo": codigo,
                    "canal": canal,
                    "creado_por": g.usuario.username,
                }
            ),
            201,
        )

    return app


def main() -> None:
    """Arranca el servidor."""
    logging.basicConfig(
        level=getattr(logging, config.servicio.nivel_log, logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    # Al apagar el proceso, cerramos Kafka para no perder eventos en el buffer.
    atexit.register(cerrar_producer)

    app = crear_aplicacion()

    print()
    print("=" * 66)
    print(f"  {config.servicio.nombre}")
    print(f"  Servidor      : http://localhost:{config.servicio.puerto}")
    print(f"  Keycloak      : {config.keycloak.url} (realm: {config.keycloak.realm})")
    print(f"  Kafka         : {config.kafka.bootstrap_servers}")
    print(f"  Seguridad     : {'ACTIVA' if config.keycloak.habilitado else 'DESACTIVADA'}")
    print(f"  Eventos Kafka : {'ACTIVOS' if config.kafka.habilitado else 'DESACTIVADOS'}")
    print("=" * 66)
    print("  Ctrl+C para detener.")
    print()

    # `debug=False` a proposito: en modo debug Flask recarga el codigo y deja
    # de ser un ejemplo didactico. Para developing, activa AUTH_HABILITADO=false.
    app.run(host="0.0.0.0", port=config.servicio.puerto, debug=False)


if __name__ == "__main__":
    main()
