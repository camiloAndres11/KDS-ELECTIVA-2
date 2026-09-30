# Configuracion de Keycloak

## Que hay aqui

`kds-realm.json` es la configuracion del realm `kds`: los usuarios, las
contrasenas, los roles y el cliente que usa nuestro servicio.

## Como se usa

No hay que hacer nada: `iniciar-keycloak.bat` (en la carpeta anterior) ya le
pasa `--import-realm` a Keycloak, asi que al arrancar el realm aparece solo.

Si prefieres importarlo a mano desde el navegador:

1. Arranca Keycloak.
2. Entra en <http://localhost:8080> con `admin` / `admin`.
3. Arriba a la izquierda, elige **master** y pulsa **Add realm**...
   No: para reemplazar uno existente, ve a `kds-realm.json` y usa
   **Partial import** en el realm `kds`.

## Que trae

### Roles del realm

| Rol                | Para quien es                     |
| ------------------ | --------------------------------- |
| `POS_SYSTEM`       | La caja. Crea pedidos.            |
| `KITCHEN_OPERATOR` | La cocina. Ve y cambia pedidos.   |
| `DISPATCHER`       | El despacho. Ve y entrega.        |
| `ADMIN`            | El administrador. Puede todo.     |
| `ANALISTA_EVENTOS` | Solo mira el historial de Kafka. |

El ultimo esta aqui a proposito, aunque el servicio todavia no lo use: sirve
para mostrar la diferencia entre "puede entrar a la API" y "solo puede ver
los datos". El servicio lo comprueba con `requiere_rol("ANALISTA_EVENTOS")`.

### Cliente `kds-api`

- **Publico** (sin secreto). Es lo mas facil para la clase, porque no hay que
  manejar `client_secret`. En produccion debe ser confidencial.
- `directAccessGrantsEnabled: true` para poder pedir tokens con `curl` sin
  navegador. En produccion esto se desactiva.

### Usuarios

| Usuario    | Contrasena    | Rol                 |
| ---------- | ------------- | ------------------- |
| `cocina`   | `cocina123`   | `KITCHEN_OPERATOR`  |
| `caja`     | `caja123`     | `POS_SYSTEM`        |
| `despacho` | `despacho123` | `DISPATCHER`        |
| `admin`    | `admin123`    | `ADMIN` y todos     |

**Estas contrasenas son de ejemplo y estan escritas en un archivo del
repositorio.** Es aceptable para una clase y es exactamente lo que hacen los
ejemplos de Keycloak, pero en un entorno real seria un fallo grave: en
produccion se pone la contrasena a mano la primera vez y Keycloak la guarda
cifrada.

## Regla importante del formato

Keycloak **rechaza el archivo entero** si tiene una clave que no reconoce, y
el error que da es poco util (`unable to read contents from stream`).

Por eso este archivo **no puede tener comentarios ni claves propias**. Si
anades algo como `"_comentario": "..."`, el realm no se importara y no
sabras por que. Si necesitas anotar algo, ponlo aqui en este README o en el
propio `kds-realm.json` como... no, no se puede. Ponlo aqui.

## Cambiar el realm

Keycloak **no** reimporta un realm que ya existe, aunque cambies el archivo.
Para que los cambios se vean tienes que:

1. Detener Keycloak.
2. Borrar la carpeta `data/` que esta al lado de `bin/`.
3. Arrancar otra vez.

O cambiar los usuarios desde la pantalla de administracion.
