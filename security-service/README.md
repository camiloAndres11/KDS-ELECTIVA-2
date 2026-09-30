# Servicio de Seguridad: Kafka + Keycloak

Este servicio es el que pide el documento del curso. Hace dos cosas:

1. **Administra eventos con Kafka.** Cada vez que pasa algo interesante
   (alguien entra con un token malo, un pedido se crea, alguien intenta
   entrar sin permiso) se escribe un "evento" en Kafka. Despues se pueden ver
   esos eventos en una pantalla web y tener una vision general de como se
   esta comportando la aplicacion.
2. **Protege las rutas con Keycloak.** Ninguna ruta se ejecuta sin un token
   valido de Keycloak, y cada ruta pide ademas el rol correcto.

Esta escrito en Python con Flask, y es **independiente** del backend que ya
existe en `../backend` (ese esta en Node/TypeScript). Este servicio no lo
toca: corre aparte, en otro puerto.

---

## 1. Las palabras que hay que saber

Si alguna de estas no te suena, leela antes de seguir. Las explico en
lenguaje sencillo, como si fuera la primera vez.

### Que es Kafka?

Kafka es un programa que **guarda mensajes en orden**, como un cuaderno donde
anotas cosas que pasaron.

Cuando algo importante ocurre, en vez de guardarlo en una base de datos, lo
"publicas" en Kafka. Queda anotado para siempre y lo puede leer **quien quiera**
despues. Ejemplo de lo que anotamos:

```json
{
  "tipo": "acceso_sin_token",
  "resultado": "rechazado",
  "endpoint": "/api/v1/pedidos",
  "metodo": "GET",
  "ip": "127.0.0.1",
  "timestamp": "2026-09-30T05:12:29.060969Z",
  "servicio": "kds-security-service"
}
```

Eso se lee facil: alguien intento entrar a `/api/v1/pedidos` sin token, desde
la computadora `127.0.0.1`, y le negamos el acceso.

**Por que es mejor que un log normal?** Porque un log se borra al reiniciar
y hay que buscar con `grep`. Kafka guarda todo ordenado y se puede filtrar y
contar facil. Por eso se dice que Kafka sirve para "administracion de eventos".

### Que es un topic?

Un topic es el **nombre del buzon** donde va el mensaje. En vez de mandar
eventos sueltos, los metemos en buzones con nombre:

| Topic               | Que va dentro                                |
| ------------------- | -------------------------------------------- |
| `seguridad.accesos` | Quien entro, quien fue rechazado, y por que |
| `pedidos.eventos`   | Los pedidos de la cocina                     |

Se separan para que el servicio de cocina no tenga que filtrar ruido de
seguridad, y para poder crear un programa que lea **solo** lo que le interesa.

### Que es un evento?

Un evento es simplemente un **diccionario de Python** que se convierte en JSON
y se manda a un topic. No es una clase especial ni nada complicado.

### Que es Keycloak?

Keycloak es un programa que hace de **portero de un edificio**. Tu le dices
"esta es mi contrasena" y Keycloak te da una credencial. Las credenciales que
entrega se llaman **tokens**.

En vez de guardar contrasenas en nuestra base de datos, dejamos que Keycloak
las guarde. Keycloak tiene una lista de usuarios, y ademas dice que puede
hacer cada uno (los **roles**).

### Que es un token (JWT)?

Cuando pasas tu usuario y contrasena a Keycloak, te devuelve un texto largo
llamado token. Tiene tres partes separadas por puntos:

```
eyJhbGciOiJSUzI1NiIs...   <- cabecera: con que algoritmo se firmo
eyJleHAiOjE3OTA3NDU0... <- contenido: quien eres, cuando caduca, tus roles
oiqWHzqFZCVdEAzOf6o...   <- firma: la prueba de que es autentico
```

Lo importante: **ese texto lleva dentro tu usuario y tus roles**, y va
"firmado" para que nadie pueda cambiarlo.

Nuestro servicio **no necesita preguntarle a Keycloak en cada peticion**. Se
descarga la llave publica una vez, y con ella comprueba la firma el solo. Eso
es lo que hace `verificar_token()` en `keycloak_service.py`.

### Que es un rol?

Es un permiso con nombre. En este servicio hay cuatro:

| Rol                | Puede hacer                              |
| ------------------ | ---------------------------------------- |
| `POS_SYSTEM`       | Crear pedidos (es la caja)               |
| `KITCHEN_OPERATOR` | Ver y cambiar los pedidos (es la cocina) |
| `DISPATCHER`       | Ver pedidos y marcarlos como entregados |
| `ADMIN`            | Todo                                     |

### Que es la diferencia entre 401 y 403?

Esto se pregunta mucho en examenes, y es importante:

- **401 Unauthorized** = "no se quien eres". O no mandaste token, o esta malo.
  El cliente debe **pedirse un token** y reintentar.
- **403 Forbidden** = "se quien eres, pero no puedes". El token era perfecto,
  solo que te faltan permisos. Pedirse otro token **no va a servir**: hay que
  hablar con el administrador.

### Que es un middleware?

Es un trozo de codigo que se ejecuta **automaticamente antes de cada
peticion**, sin que cada ruta tenga que acordarse de llamarlo.

Si el middleware responde con un error, la ruta **nunca se ejecuta**. Por eso
es el sitio adecuado para comprobar el token de todo el servicio de una vez.

---

## 2. Puesta en marcha (desde cero)

### Que necesitas instalado

| Programa | Version  | Para qué                              |
| -------- | -------- | ------------------------------------- |
| Python   | 3.11+    | correr el servicio                    |
| Docker   | reciente | levantar Kafka sin instalar nada mas |
| Java     | 17+      | Keycloak                              |

### Paso 1 - Entrar en esta carpeta

```bash
cd security-service
```

### Paso 2 - Crear un entorno virtual

Un *entorno virtual* es una carpeta donde se instalan las librerias de **este**
proyecto sin mezclarlo con las de otros. Es buena practica: si algo se rompe,
solo se rompe aqui.

```bash
python -m venv .venv
```

Activalo (esto depende del sistema, no de nada que hagamos nosotros):

```bash
# Windows
.venv\Scripts\activate

# Linux / Mac
source .venv/bin/activate
```

Veras al principio de la linea algo como `(.venv)`. Ya esta activo.

### Paso 3 - Instalar las librerias

```bash
pip install -r requirements-dev.txt
```

Esto instala Flask, la libreria de Kafka, la de los tokens y las de pruebas.
Puede tardar un minuto la primera vez.

### Paso 4 - Copiar el archivo de configuracion

```bash
copy .env.example .env      # Windows
cp .env.example .env        # Linux / Mac
```

`.env` guarda la configuracion. **No se sube al repositorio** (esta en el
`.gitignore`), y por eso las contrasenas nunca estan escritas en el codigo.

Puedes abrirlo y cambiar los valores. Ahora mismo esta bien para trabajar en
local.

### Paso 5 - Levantar Kafka

```bash
iniciar-kafka.bat     # Windows (doble click tambien vale)
```

O a mano:

```bash
docker compose up -d
```

La primera vez descarga imagenes grandes y tarda varios minutos. Cuando
termine deberias ver:

```
kds-kafka       Up (healthy)   0.0.0.0:9092->9092/tcp
kds-kafka-ui    Up             0.0.0.0:8083->8080/tcp
kds-zookeeper   Up             2181/tcp
```

**La forma mas rapida de comprobar que funciona:** abre
<http://localhost:8083>. Es la pantalla web de Kafka.

> Si Docker no esta abierto, `iniciar-kafka.bat` avisa y se para.

### Paso 6 - Levantar Keycloak

```bash
iniciar-keycloak.bat
```

Tarda 1 o 2 minutos. Cuando en la ventana aparezca
`Keycloak 26.1.4 ... started in ...`, esta listo.

- Pantalla de Keycloak: <http://localhost:8080>
- Usuario de administracion: `admin` / `admin`
- Realm: `kds`

El realm es como una "base de datos de usuarios". Al arrancar, Keycloak
importa solo el archivo `keycloak/kds-realm.json`, que ya trae los cuatro
usuarios de prueba y los roles listos.

> **Ojo:** Keycloak guarda todo (usuarios, roles y su base de datos interna)
> en la carpeta `data/` que esta **dentro de la carpeta de Keycloak**, o sea
> `keycloak-26.1.4\data\`. `iniciar-keycloak.bat` copia ahi tu
> `kds-realm.json` cada vez que arranca. Si borras esa carpeta, usuarios y
> roles desaparecen y se vuelven a crear al arrancar de nuevo.

### Paso 7 - Levantar el servicio

Abre **otra** terminal, activa el entorno virtual y:

```bash
cd security-service
python app.py
```

Deberias ver:

```
==================================================================
  kds-security-service
  Servidor      : http://localhost:5000
  Keycloak      : http://localhost:8080 (realm: kds)
  Kafka         : localhost:9092
  Seguridad     : ACTIVA
  Eventos Kafka : ACTIVOS
==================================================================
```

Con esto ya tienes las tres piezas andando. Dejalas en terminales separadas.

### Los puertos que usamos

| Puerto | Programa      | Para qué                          |
| ------ | ------------- | --------------------------------- |
| 5000   | Este servicio | las rutas `/api/v1/...`           |
| 8080   | Keycloak      | pedir tokens                      |
| 8083   | kafka-ui      | mirar los eventos en el navegador |
| 9092   | Kafka         | donde se escriben los eventos     |

> Keycloak ocupa el 8080, por eso este servicio usa el 5000. Si mueves alguno
> de los dos, cambia el otro en `.env`.

---

## 3. Probar que todo funciona

### 3.1 Conseguir un token

Un token es la credencial. La forma mas comoda de obtenerla:

```bash
python pedir_token.py cocina
```

Imprime un texto larguisimo. Ese es el token.

Si no dices usuario, te muestra la lista de usuarios disponibles:

| Usuario    | Contrasena   | Rol                |
| ---------- | ------------ | ------------------ |
| `cocina`   | `cocina123`  | `KITCHEN_OPERATOR` |
| `caja`     | `caja123`    | `POS_SYSTEM`       |
| `despacho` | `despacho123`| `DISPATCHER`       |
| `admin`    | `admin123`   | `ADMIN` (y todos)  |

### 3.2 Probar las rutas

Copia el token de antes y pegalo donde dice `<TOKEN>`.

**Ruta publica (no pide nada):**

```bash
curl http://localhost:5000/health
```

**Sin token, deberia dar 401:**

```bash
curl -i http://localhost:5000/api/v1/perfil
```

**Con token valido, deberia dar 200:**

```bash
curl http://localhost:5000/api/v1/perfil -H "Authorization: Bearer <TOKEN>"
```

Deberias ver quien eres:

```json
{
  "usuario": "cocina",
  "roles": ["KITCHEN_OPERATOR"],
  "email": "cocina@kds.local"
}
```

### 3.3 La parte interesante: el rol equivocado

`cocina` **puede ver** los pedidos pero **no puede crearlos**. Pide un token de
`cocina` e intenta crear un pedido:

```bash
curl -i -X POST http://localhost:5000/api/v1/pedidos ^
  -H "Authorization: Bearer <TOKEN_DE_COCINA>" ^
  -H "Content-Type: application/json" ^
  -d "{\"canal\": \"DINE_IN\"}"
```

Sale **403 Forbidden**. Y sin embargo, leer si funciona:

```bash
curl http://localhost:5000/api/v1/pedidos -H "Authorization: Bearer <TOKEN_DE_COCINA>"
```

Sale **200**. Esa diferencia es el control de roles funcionando.

### 3.4 Ver los eventos

Opcion A, la pantalla web (la mas visual):

<http://localhost:8083> -> **Topics** -> `seguridad.accesos` -> **Messages**

Opcion B, desde la terminal:

```bash
python ver_eventos.py --desde-inicio
```

Opciones utiles:

```bash
python ver_eventos.py --desde-inicio            # incluye los antiguos
python ver_eventos.py --topic seguridad.accesos  # solo un topic
python ver_eventos.py --contar                  # solo el resumen
```

> `ver_eventos.py` **consume** los mensajes (se los lleva para mostrarlos).
> Si lo dejas corriendo mientras pruebas, se lleva los eventos que ibas a ver.
> Por eso tiene `--desde-inicio`: Kafka recuerda por donde iba y los relee.

### 3.5 Lo que deberias ver

Haz estas cuatro peticiones en orden y mira el resumen:

| Peticion                              | Evento en Kafka         |
| ------------------------------------- | ----------------------- |
| `/api/v1/perfil` sin token            | `acceso_sin_token`      |
| `/api/v1/perfil` con token de cocina  | `acceso_permitido`      |
| `POST /api/v1/pedidos` con cocina     | `acceso_denegado`       |
| `POST /api/v1/pedidos` con caja       | va a `pedidos.eventos`  |

Eso es la "administracion de eventos": ahora puedes responder "quien intento
entrar sin permiso esta manana?".

---

## 4. Los archivos y para que sirve cada uno

```
security-service/
├── app.py                  El programa que se ejecuta. Rutas de ejemplo.
├── config.py               Lee la configuracion de .env
├── kafka_producer.py       Envia eventos a Kafka  (publicar_evento)
├── keycloak_service.py     Valida el token  (verificar_token)
├── keycloak_middleware.py  Protege las rutas (registrar_middleware, requiere_rol)
├── eventos.py              Los nombres de los topics y las plantillas
├── pedir_token.py          Pide un token a Keycloak (util para probar)
├── ver_eventos.py          Muestra los eventos (consumidor)
├── docker-compose.yml      Kafka + Zookeeper + kafka-ui
├── iniciar-kafka.bat       Atajo para levantar Kafka
├── iniciar-keycloak.bat    Atajo para levantar Keycloak
├── keycloak/
│   └── kds-realm.json      Usuarios y roles de ejemplo
├── tests/                  Las pruebas automaticas
├── requirements.txt        Las librerias que necesita
├── requirements-dev.txt    Las librerias + las de pruebas
├── .env.example            Plantilla de configuracion
└── pytest.ini              Configuracion de las pruebas
```

### kafka_producer.py - el productor de eventos

Contiene `publicar_evento(topic, evento)`, que es la funcion del documento.
Tres decisiones importantes que conviene entender:

**1. La conexion se abre la primera vez que se necesita**, no al arrancar.
Si Kafka esta caido, el servicio **igual arranca** y solo deja de registrar
eventos. Un problema de observabilidad nunca debe tumbar el servicio principal.

**2. `publicar_evento` nunca lanza una excepcion.** Si falla, lo anota en el
log y devuelve `False`. Perder un evento es malo; tumbar la API es peor.

**3. Nunca escribe el token en el log.** Los tokens son credenciales.

```python
from kafka_producer import publicar_evento

publicar_evento("seguridad.accesos", {
    "tipo": "acceso_permitido",
    "endpoint": "/api/v1/perfil",
    "ip": "127.0.0.1",
})
```

### eventos.py - el contrato

Aqui **solo se construyen diccionarios**, no se manda nada a Kafka. Asi se
puede probar que los eventos tienen la forma correcta sin levantar Kafka.

Si algun dia cambias el nombre de un campo, el consumidor del otro lado se
rompe. Por eso hay un test (`tests/test_eventos.py`) que fija esos nombres.

### keycloak_service.py - valida el token

`verificar_token(token)` hace cuatro comprobaciones:

1. Que el texto sea un JWT de verdad (mira la cabecera, sin verificar nada).
2. Que la firma sea autentica, con la llave publica que publica Keycloak.
3. Que no haya caducado (`exp`).
4. Que sea de **nuestro** Keycloak (`iss`). Asi el token de otro servidor no
   nos sirve.

Y devuelve un objeto `Usuario` con los roles ya sacados del token.

> **Por que la lista `ALGORITMOS_ACEPTADOS = ["RS256"]`?**
> Hay un ataque clasico: si el servidor acepta el algoritmo que dice el propio
> token, alguien puede poner `alg: none` y mandar un token sin firmar que el
> servidor aceptaria. Fijar la lista de algoritmos admitidos lo evita.
> Hay un test que lo comprueba.

### keycloak_middleware.py - el portero

Dos piezas:

- `registrar_middleware(app)`: se ejecuta antes de cada peticion. Deja pasar
  las rutas publicas, exige token en el resto y publica el evento.
- `requiere_rol("A", "B")`: un decorador para las rutas que ademas piden un
  rol concreto.

```python
@app.get("/api/v1/pedidos")
@requiere_rol("KITCHEN_OPERATOR", "DISPATCHER", "ADMIN")
def listar_pedidos():
    ...   # aqui ya sabemos que el token es bueno y tiene uno de esos roles
```

### app.py - el servicio

Las rutas de ejemplo, para ver el middleware en accion. En un proyecto real,
aqui iria la llamada a la base de datos o al backend de pedidos.

---

## 5. Las pruebas

Hay 66 pruebas automaticas. Se ejecutan asi:

```bash
python -m pytest
```

**No necesitan ni Kafka ni Keycloak.** Las pruebas fabrican una llave
criptografica y un token en memoria, y sustituyen las conexiones por dobles
de prueba. Eso permite comprobar la verificacion de tokens de verdad
(incluidos los casos de ataque) sin depender de nada externo.

```
66 passed
```

Que se comprueba, en resumen:

- El evento lleva fecha, servicio y los campos correctos.
- `publicar_evento` no falla aunque Kafka no este.
- Se rechazan tokens caducados, de otro emisor, mal firmados o sin firma.
- 401 sin token, 403 sin rol, 200 con lo correcto.
- Cada respuesta va con su evento de Kafka correspondiente.

---

## 6. Problemas frecuentes

### "Address already in use" al arrancar

Otro programa ya usa ese puerto. Mira cual con
`netstat -ano | findstr :5000` y cambia `PUERTO` en `.env`.

### "No hay ningun broker de Kafka"

Kafka no esta levantado:

```bash
docker compose ps       # para ver el estado
iniciar-kafka.bat       # o docker compose up -d
```

Kafka tarda unos segundos mas que Zookeeper en estar listo.

### "keycloak_no_disponible"

Keycloak no responde. Comprueba que la ventana de `iniciar-keycloak.bat` siga
abierta, y que `KEYCLOAK_URL` en `.env` diga `http://localhost:8080`.

### "El token caduca muy rapido"

En `keycloak/kds-realm.json` esta `accessTokenLifespan: 300` (5 minutos), a
proposito, para que se vea como el sistema lo rechaza. Cambialo si te molesta
y vuelve a importar el realm (borrando antes la carpeta `data` de Keycloak).

### Cambie el realm y no se ve

Keycloak **no** reimporta un realm que ya existe, aunque cambies el archivo
`kds-realm.json`. Solo mira los realms al arrancar, y si el nombre ya existe se
lo salta. Para que los cambios se vean:

1. Detén Keycloak (Ctrl+C).
2. Borra la carpeta `keycloak-26.1.4\data`.
3. Arranca otra vez.

O cambia los usuarios desde la pantalla de administración.

### `pip: command not found` (Linux/Mac)

Activa el entorno virtual primero (Paso 2), o usa `python -m pip` en vez de
`pip`.

---

## 7. Avisos de seguridad

Esto es material de clase. Antes de usarlo en algo real:

- **Las contrasenas del archivo `kds-realm.json` son de ejemplo.** En
  produccion no se escribe una contrasena en un archivo: se ponen a mano la
  primera vez y Keycloak las guarda cifradas.
- **El cliente `kds-api` es publico**, para no tener que manejar secretos en
  la clase. En produccion debe ser **confidencial**, con su `client_secret`
  guardado en variables de entorno.
- **El flujo de contrasena (`grant_type=password`) esta activado** solo para
  poder hacer pruebas con `curl`. Keycloak lo tiene apagado por defecto, y es
  correcto: sirve para que una app se haga pasar por un usuario. En produccion
  se usa el flujo normal de login con navegador.
- **`AUTH_HABILITADO=false` apaga toda la seguridad.** Esta para trabajar en
  local sin Keycloak. Nunca en un entorno real.
- Este servicio corre con el servidor de desarrollo de Flask, que avisa
  claramente de que no es para produccion. Para produccion se usaria un
  servidor como gunicorn detras de un proxy.

---

## 8. Preguntas que suelen salir en la defensa

**Por que Kafka y no una base de datos?**
Kafka esta pensado para **escribir muchos eventos y leerlos despues**, en
orden y sin borrarlos. Guardar cada acceso en una tabla de SQL obliga a
escribir (y bloquear) en cada peticion, y los logs se pierden al reiniciar.

**Que pasa si Kafka se cae?**
El servicio sigue funcionando: `publicar_evento` anota el error y devuelve
`False`. Se pierden eventos, pero no se caen peticiones. La conexion se
reintenta en el siguiente evento.

**Que pasa si Keycloak se cae?**
Las peticiones con token **no** se pueden validar, asi que se rechazan (401).
Un fallo de Keycloak deja el servicio en modo cerrado. Por eso el token es
autofirmado: mientras ya tenemos la llave publica cacheada, se puede seguir
validando sin hablar con Keycloak.

**Como sabes que un evento no se puede falsear?**
Kafka guarda el evento en varias replicas (aunque en este ejemplo haya una
sola por simplicidad) y el `offset` es un numero que solo avanza. Si
desaparece un evento, se nota al comparar los offsets.

**Que es idempotencia?**
Que si el mismo evento llega dos veces, el consumidor lo procesa una sola. En
este proyecto lo activamos en el productor (`acks="all"` +
`enable_idempotence=True`) para que un reintento no duplique el evento.
