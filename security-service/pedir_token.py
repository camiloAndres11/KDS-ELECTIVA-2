"""Pide un token a Keycloak y lo imprime.

Sirve para las pruebas manuales: en lugar de copiar y pegar un JSON enorme
en el navegador, esto te da el token suelto.

Como usarlo:

    python pedir_token.py cocina
    python pedir_token.py caja
    python pedir_token.py admin
    python pedir_token.py despacho
    python pedir_token.py cocina --guardar token.txt

Los usuarios y contrasenas salen del archivo keycloak/kds-realm.json.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from config import RAIZ_SERVICIO, config

# De donde sale el cuerpo del token, tal como se creo en kds-realm.json.
# Se releen del archivo para no repetirlos aqui.
ARCHIVO_REALM = RAIZ_SERVICIO / "keycloak" / "kds-realm.json"


def cargar_contrasenas() -> dict[str, str]:
    """Lee usuario -> contrasena desde el archivo del realm."""
    if not ARCHIVO_REALM.exists():
        raise FileNotFoundError(f"No encuentro {ARCHIVO_REALM}")

    datos = json.loads(ARCHIVO_REALM.read_text(encoding="utf-8"))
    return {
        usuario["username"]: usuario["credentials"][0]["value"]
        for usuario in datos.get("users", [])
        if usuario.get("credentials")
    }


def pedir_token(usuario: str, contrasena: str) -> str:
    """Pide un token a Keycloak usando el flujo de contrasena.

    Flujo "password" / Resource Owner Password Credentials: el usuario da su
    contrasena y Keycloak devuelve un token a cambio. Es el mas simple, y por
    eso Keycloak viene con `directAccessGrantsEnabled` apagado: solo se usa
    para pruebas, nunca en una app de verdad.
    """
    url = f"{config.keycloak.emisor}/protocol/openid-connect/token"
    cuerpo = urlencode(
        {
            "client_id": config.keycloak.client_id,
            "grant_type": "password",
            "username": usuario,
            "password": contrasena,
        }
    ).encode("utf-8")

    peticion = Request(url, data=cuerpo, method="POST")
    peticion.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urlopen(peticion, timeout=10) as respuesta:
            datos = json.loads(respuesta.read().decode("utf-8"))
    except HTTPError as error:
        detalle = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Keycloak rechazo la peticion ({error.code}): {detalle}") from error
    except URLError as error:
        raise RuntimeError(
            f"No se pudo conectar con Keycloak en {url}. Esta arrancado? -> {error.reason}"
        ) from error

    return str(datos["access_token"])


def mostrar_resumen_usuarios(contrasenas: dict[str, str]) -> None:
    print("Usuarios disponibles en el realm de desarrollo:")
    for nombre in contrasenas:
        print(f"  {nombre}")
    print()


def main() -> int:
    analizador = argparse.ArgumentParser(description="Pide un token de Keycloak.")
    analizador.add_argument("usuario", nargs="?", help="Nombre de usuario del realm 'kds'.")
    analizador.add_argument("--guardar", metavar="ARCHIVO", help="Guarda el token en un archivo.")
    argumentos = analizador.parse_args()

    contrasenas = cargar_contrasenas()

    if not argumentos.usuario:
        mostrar_resumen_usuarios(contrasenas)
        return 0

    if argumentos.usuario not in contrasenas:
        print(f"ERROR: el usuario '{argumentos.usuario}' no existe en {ARCHIVO_REALM.name}.")
        print()
        mostrar_resumen_usuarios(contrasenas)
        return 1

    try:
        token = pedir_token(argumentos.usuario, contrasenas[argumentos.usuario])
    except RuntimeError as error:
        print(f"ERROR: {error}")
        return 1

    if argumentos.guardar:
        destino = Path(argumentos.guardar)
        destino.write_text(token, encoding="utf-8")
        print(f"Token guardado en {destino}")
    else:
        print(token)
        print()
        print("Para usarlo:")
        print(f'  curl http://localhost:{config.servicio.puerto}/api/v1/perfil -H "Authorization: Bearer {token[:20]}..."')

    return 0


if __name__ == "__main__":
    sys.exit(main())
