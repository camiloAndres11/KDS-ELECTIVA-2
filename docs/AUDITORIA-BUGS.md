# Auditoría de bugs — KDS (Electiva 2)

**Fecha:** 2026-10-08 · **Rama:** `dev` (commit `29401ae`)
**Alcance:** `backend/` (Express + Prisma + Socket.IO), `frontend/` (Angular 21), `security-service/` (Flask + Kafka + Keycloak), infraestructura (`serverless.yml`, `keycloak-image/`, scripts `.bat`).

## Resumen

| Suite | Resultado |
|---|---|
| Backend (`vitest`) | 21/21 OK · `tsc --noEmit` limpio |
| Frontend (`ng test`) | 5/5 OK |
| Security-service (`pytest`) | todos OK |

Todos los tests pasan, así que **ninguno de los bugs de abajo está cubierto por un test**. Los hallazgos marcados con ✅ se reprodujeron ejecutando el código; el resto salen de leer el código y seguir el flujo completo.

| Severidad | Cantidad | IDs |
|---|---|---|
| Alta | 7 | B1, B2, B3, B4, SEC1, INF1, INF3 |
| Media | 14 | B5, B6, B7, F1, F2, F3, F4, F5, S1, S2, S3, C1, INF2, R1 |
| Baja | 11 | B8–B11, S4–S7, F6–F8 |

---

## Hallazgos: severidad alta

### B1 — Los pedidos listos desaparecen del tablero a los 5 min aunque no se hayan despachado
- **Dónde:** `backend/src/services/order.service.ts:7`, `backend/src/repositories/prisma-order.repository.ts:64`
- **Problema:** `findActiveForKds` solo devuelve los `READY` con `readyAt >= ahora - 5 min`. El tablero recarga cada 10 s (`kds-store.service.ts:50`), así que un pedido que lleva más de 5 min listo sale de la columna "Listos" y ya no se puede despachar desde la UI. Se queda en `READY` en la BD para siempre.
- **Escenario:** el cocinero marca un pedido como listo → el despachador tarda 6 min → el pedido desaparece y el botón "Despachar" ya no está disponible.
- **Solución:** quitar el TTL de `READY`, porque la columna se vacía al despachar. Si se quiere un histórico corto, aplicar el TTL a `DISPATCHED`, no a `READY`.
  ```ts
  where: { status: { in: ['PENDING', 'IN_PREPARATION', 'READY'] } }
  ```
  Eliminar `READY_TTL_MINUTES` y el parámetro `readyTtlMinutes` de `OrderRepository` y del repositorio en memoria.

### B2 — Un `displayCode` duplicado responde 500 en lugar de un error de negocio
- **Dónde:** `backend/src/repositories/prisma-order.repository.ts:38-51`, `backend/src/domain/errors.ts:22`
- **Problema:** `displayCode` es `@unique`. Prisma lanza `P2002`, nadie lo captura y el error termina en "Error Interno 500". `DuplicateDisplayCodeError` está definido y mapeado en el middleware, pero **nunca se lanza**. El repositorio en memoria no valida la unicidad, por eso los tests no lo detectan.
- **Escenario:** el POS envía `#P-1` dos veces → 500 y un stack trace en el log.
- **Solución:**
  ```ts
  import { Prisma } from '@prisma/client';
  // en create():
  try { ... } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DuplicateDisplayCodeError(input.displayCode);
    throw e;
  }
  ```
  Cambiar el status a **409** en `error.middleware.ts:48`, porque es un conflicto y no una petición mal formada. Hacer que `InMemoryOrderRepository.create` también rechace duplicados y añadir un test.
- **Pregunta abierta:** la unicidad es global y permanente. Si un POS real reinicia la numeración cada día (`#001`), chocará desde el segundo día. Conviene decidir si la unicidad debe ser por día o solo entre pedidos activos.

### B3 ✅ — Un JSON malformado o un body demasiado grande responden 500
- **Dónde:** `backend/src/middlewares/error.middleware.ts:19-57`
- **Problema:** los errores de `express.json()` (`entity.parse.failed` 400 y `entity.too.large` 413) traen `status` y `expose`, pero `toProblem` no los reconoce y responde 500 con un `console.error` del stack.
- **Reproducido:** `POST /api/v1/orders` con body `{"x":` → **500**; body de 200 KB → **500**.
- **Solución:** antes del fallback 500:
  ```ts
  const status = (err as { status?: number })?.status;
  if (status && status >= 400 && status < 500) {
    return { type: 'about:blank', title: 'Petición inválida', status, detail: (err as Error).message };
  }
  ```
  Añadir un test con supertest para cada uno de los dos casos.

### B4 ✅ — `CORS_ORIGINS` con espacios rompe CORS y Socket.IO en el servidor Node
- **Dónde:** `backend/src/config/env.ts:5` (causa raíz); también `backend/src/server.ts:26-30` y `backend/src/lambda.ts:14-17` (parseo duplicado)
- **Problema:** `env.ts` hace `split(',')` sin `trim()`. `lambda.ts` sí recorta, pero `server.ts` y `socket.ts` usan `env.CORS_ORIGINS` sin recortar. Con `CORS_ORIGINS=http://a.com, http://b.com` el segundo origen queda `" http://b.com"` y nunca coincide.
- **Reproducido:** con el origen `" http://b.com"` configurado, la respuesta no trae `Access-Control-Allow-Origin`.
- **Solución:** arreglarlo en el sitio por el que pasan todos los usos:
  ```ts
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:4200').split(',').map((o) => o.trim()).filter(Boolean),
  ```
  y en `lambda.ts` usar `env.CORS_ORIGINS` en vez de repetir el parseo.

### SEC1 — API pública sin autenticación y build de producción con login mock
- **Dónde:** `backend/serverless.yml:14` (`AUTH_ISSUER` vale `''` por defecto), `frontend/angular.json:33-47,78`, `frontend/src/environments/environment.ts:18-30`
- **Problema:**
  1. La Lambda desplegada (`vtl24350ra.execute-api...`) arranca sin `AUTH_ISSUER`, así que **cualquiera en Internet puede crear y cambiar pedidos**. El manual lo documenta como estado actual, pero sigue siendo el riesgo principal.
  2. `ng build` usa por defecto la configuración `production`, y esa configuración **no tiene `fileReplacements`**. El build "de producción" empaqueta `environment.ts`: auth `mock`, `production: false` y las contraseñas `uptc2025` en texto plano dentro del JS. El login mock solo vive en el cliente y se salta con `localStorage.setItem('kds-mock-user','admin')`.
- **Solución:**
  - Desplegar siempre con `AUTH_ISSUER`. Para que un olvido sea imposible, hacer que `serverless.yml` falle si falta, quitando el default `''`: `AUTH_ISSUER: ${env:AUTH_ISSUER}`.
  - En `angular.json`, cambiar `defaultConfiguration` a `development` o darle a `production` un `fileReplacements` hacia un environment con `provider: 'keycloak'`. Que `mockUsers` solo exista en los environments `*.local.ts`.

### INF1 — La tarea ECS de Keycloak (`serverless.yml` raíz) no puede arrancar
- **Dónde:** `serverless.yml:29-48` (y `.serverless/serverless-state.json`, que indica que ya se desplegó)
- **Problemas:**
  1. `start --optimized` sobre la imagen oficial sin build previo, con `KC_DB=postgres`, que es una opción de *build time*. Keycloak se niega a arrancar si las opciones de build no coinciden con las de la imagen.
  2. Valores placeholder desplegados: `YOUR_RDS_ENDPOINT`, `YOUR_DB_PASSWORD`, `kds.yourdomain.com`.
  3. `KC_PROXY=edge` fue eliminado en Keycloak 25 y superiores. Detrás de un proxy se necesita `KC_PROXY_HEADERS=xforwarded`.
  4. `KC_BOOTSTRAP_ADMIN_PASSWORD=admin123` en texto plano y versionado.
  5. Sin ALB, TLS ni health check. Subnet y SG hardcodeados y una sola subnet. Además `org/app/service` siguen como `my-app`/`my-service`.
- **Solución:** usar `start` (sin `--optimized`) o una imagen propia que ejecute `kc.sh build --db=postgres`. Leer los secretos de SSM o Secrets Manager (`${ssm:/kds/keycloak/db-password}`). Reemplazar `KC_PROXY` y poner un ALB con certificado delante. Mientras eso no esté listo, conviene **eliminar el stack** (`serverless remove`) para no pagar una tarea que entra en bucle de reinicios.

### INF3 ✅ — `iniciar-keycloak.bat` busca Keycloak en la carpeta equivocada
- **Dónde:** `security-service/iniciar-keycloak.bat:19-20`
- **Problema:** `%~dp0..\..\keycloak-26.1.4` sube **dos** niveles (hasta `Documents\`), pero Keycloak está en la raíz del repo, **un** nivel arriba de `security-service\`. El script siempre termina en "ERROR: no encuentro Keycloak".
- **Verificado:** `Documents/keycloak-26.1.4` no existe; `Electiva 2/keycloak-26.1.4/bin/kc.bat` sí existe.
- **Solución:** `set "KEYCLOAK_HOME=%~dp0..\keycloak-26.1.4"` y `set "KEYCLOAK_BIN=%KEYCLOAK_HOME%\bin"`, y actualizar el comentario de las líneas 27-28.

---

## Hallazgos: severidad media

### Backend

**B5 — La auditoría nunca guarda quién hizo el cambio.**
`prisma-order.repository.ts:92-94,107-109` crea `AuditLog` sin `userId`, y el `principal` (`res.locals.principal`) nunca llega al servicio. Con autenticación activa, la tabla `audit_logs.user_id` queda siempre en `NULL`.
→ Pasar `res.locals.principal.username` desde `kitchen.controller.ts:14,21` → `OrderService.changeStatus/changePriority` → repositorio.

**B6 — Se puede cambiar la prioridad de pedidos ya despachados o cancelados.**
`prisma-order.repository.ts:102-105` solo comprueba `version`.
→ Añadir `status: { in: ['PENDING', 'IN_PREPARATION', 'READY'] }` al `where`. En el servicio, si falla, releer y distinguir 409 (versión distinta) de 400 (estado final), igual que hace `changeStatus`.

**B7 — `order:priority_changed` no lleva `version`, así que las demás pantallas quedan con una versión vieja.**
`realtime/events.ts:12-15` y `frontend/src/app/kds/kds-store.service.ts:44-46`. Tras un cambio de prioridad, el siguiente clic en otra pantalla manda la versión anterior → 409 → recarga silenciosa (ver F1). El usuario tiene que pulsar dos veces.
→ Añadir `version` a `PriorityChangedEvent` (backend y `ws-event.interface.ts`) y actualizarla en el store.

### Frontend

**F1 — Los errores de las acciones del tablero se tragan en silencio y hay botones que el usuario no puede usar.**
`kds-store.service.ts:57-69`: cualquier error (403, 409, 400, red) solo hace `reload()`, sin avisar. `tarjeta-pedido.component.html:32` muestra el botón a todos, incluido `POS_SYSTEM`, que recibe 403. Un doble clic manda dos PATCH con la misma versión y el segundo da 409.
→ Mostrar un mensaje (signal `error` en el store), ocultar o deshabilitar los botones si el usuario no tiene `KITCHEN_OPERATOR | DISPATCHER | ADMIN`, y deshabilitar el botón mientras la petición está en curso.

**F2 — Peticiones con token vencido (modo Keycloak).**
`core/interceptors/auth.interceptor.ts:10` adjunta `keycloak.token` tal cual. Entre que vence el token y termina `onTokenExpired`, las peticiones salen con un token caducado → 401 silencioso.
→ En el interceptor, `from(keycloak.updateToken(30)).pipe(switchMap(() => next(conToken)))` cuando `provider === 'keycloak'`.

**F3 — Si el handshake del socket es rechazado, no vuelve a intentarlo.**
`core/realtime/socket.service.ts:18-24`. Cuando el middleware del servidor rechaza la conexión (`connect_error: unauthorized`), socket.io-client **no reconecta solo** (`socket.active === false`). El indicador se queda en "Reconectando…" para siempre. El polling sigue funcionando, pero se pierde el tiempo real.
→ `socket.on('connect_error', () => { if (!socket.active) setTimeout(() => socket.connect(), 5000); })`. El callback `auth` ya toma el token refrescado.

**F4 — Cerrar sesión no detiene el polling ni el socket.**
`kds-store.service.ts:50` (`setInterval` nunca se limpia; `inicializado` nunca vuelve a `false`) y `encabezado-kds.component.ts:42-47`. En modo mock, tras "Salir" el store sigue consultando la API cada 10 s y el socket sigue abierto con la identidad anterior.
→ Añadir `KdsStoreService.reset()` (`clearInterval`, `socket.disconnect()`, `_orders.set([])`, `inicializado = false`) y llamarlo desde `AuthService.logout()`.

**F5 — `order:created` no deduplica y los eventos viejos pisan el estado.**
`kds-store.service.ts:36-43`. Si la respuesta de un `reload()` ya trae el pedido y después llega el evento, el pedido aparece dos veces (y `track pedido.id` se queja de claves duplicadas). `status_changed` tampoco compara versiones.
→ Hacer *upsert* por `id` y aplicar el evento solo si `event.version > o.version`.

### Security-service

**S1 — `@requiere_rol` deja pasar la petición cuando no hay usuario.**
`keycloak_middleware.py:215-217`: si `g.usuario` no existe, ejecuta la ruta. Pasa si alguien añade la ruta a `RUTAS_SIN_AUTENTICAR` o si el middleware no quedó registrado.
→ Dejar pasar solo si `current_app.config["AUTH_HABILITADO"]` es `False`; en cualquier otro caso responder 401.

**S2 — Si Keycloak está caído se responde 401 en lugar de 503.**
`keycloak_service.py:219-221,244-245` convierte "Keycloak no responde" en `TokenInvalidoError`, y el middleware (`:161-175`) responde 401 `invalid_token`. El cliente borra un token que en realidad era válido. Además es incoherente con el backend Node, que en ese caso devuelve 500 (`auth.middleware.ts:29-30`).
→ Crear `KeycloakNoDisponibleError` y que el middleware responda **503**. Hay que ajustar `tests/test_keycloak_service.py:199`.

**S3 — Cada petición espera a Kafka de forma síncrona.**
`kafka_producer.py:163-164` hace `flush()` y `get()` en cada evento. Con `PUBLICAR_ACCESOS_PERMITIDOS=true` (el valor por defecto) eso pasa en **todas** las peticiones autenticadas. Si Kafka está caído, `obtener_producer` (`:110-118`) reintenta conectar en cada petición, sin backoff. Resultado: hasta unos 5 s de latencia extra por petición.
→ `producer.send(...).add_errback(log)` sin `flush`, y recordar la hora del último fallo de conexión para no reintentar antes de, por ejemplo, 30 s.

### Configuración e infraestructura

**C1 — Los realms y clientes que usan frontend y backend no existen en el repo.**
El front y el backend esperan los realms `kds-starpizza`, `kds-delarosepizza` y `kds-dev` con el cliente `kds-frontend`. El único realm versionado es `kds`, con el cliente `kds-api` (`security-service/keycloak/kds-realm.json`). Además `post.logout.redirect.uris` solo admite `http://localhost:5000/*`, así que el logout del front (`auth.service.ts:61` → `:4200/auth/login`) sería rechazado por Keycloak.
→ Exportar y versionar los realms por tenant, o añadir el cliente `kds-frontend` con `http://localhost:4200/*` en `redirectUris` y en `post.logout.redirect.uris`.

**INF2 — `keycloak-image/Dockerfile` no puede funcionar.**
El `ENTRYPOINT` es `aws-lambda-rie` envolviendo `kc.sh`, pero Keycloak no es un handler de Lambda y el RIE también escucha en el puerto 8080. Repite además los placeholders y `admin123`. Ningún archivo lo usa.
→ **Borrarlo.** Si hace falta una imagen propia, hacer un build multi-stage con `kc.sh build --db=postgres` (ver INF1).

**R1 — Artefactos y binarios versionados.**
Están en git `frontend/dist-dev/` (build con sourcemaps), `.serverless/` (estado de despliegue con IDs de cuenta) y la distribución completa `keycloak-26.1.4/` (445 archivos). El realm además está duplicado en `keycloak-26.1.4/data/import/` y en `security-service/keycloak/`, lo que invita a que se desincronicen.
→ Añadir `dist-dev/`, `.serverless/` y `keycloak-26.1.4/` a `.gitignore` y ejecutar `git rm -r --cached` sobre esas rutas. Documentar la descarga de Keycloak en el README, porque `iniciar-keycloak.bat` ya copia el realm al arrancar.

---

## Hallazgos: severidad baja

| ID | Dónde | Problema | Solución |
|---|---|---|---|
| B8 | `backend/src/config/env.ts:3` | `PORT=abc` → `NaN` y Node escucha en un puerto aleatorio | Validar y abortar con un mensaje claro |
| B9 | `backend/src/services/order.service.ts:64-67` | `generateDisplayCode` no se usa y su comentario dice "incremental" cuando es aleatorio | Borrarla |
| B10 | `backend/src/middlewares/auth.middleware.ts:76` | `split(' ')` falla con `Bearer  token` (doble espacio) | `/^Bearer\s+(.+)$/i` |
| B11 | `backend/src/lambda.ts:10` | Crea su propio `PrismaClient` en vez de reutilizar `lib/prisma.ts` | Importar `prisma` de `lib/prisma.js` |
| S4 | `security-service/app.py:153,163` | El `pedido_id` del evento Kafka y el `id` de la respuesta son dos UUID distintos, así que no se pueden correlacionar | Generar el id una sola vez |
| S5 | `security-service/ver_eventos.py:138-141` | Lee un mensaje más que `--max` y, con `group_id`, hace commit de su offset, así que ese mensaje no se ve en la siguiente ejecución | `for mensaje in itertools.islice(consumidor, argumentos.max)` |
| S6 | `security-service/keycloak_middleware.py:101` | `"Bearer "` distingue mayúsculas (RFC 6750: no debería) | Comparar con `lower()` |
| S7 | `security-service/app.py:21` | El ejemplo `curl` usa el puerto 8080 (Keycloak) en vez del 5000 | Corregir el docstring |
| F6 | `frontend/src/app/app.config.ts:14` | `APP_INITIALIZER` está deprecado desde Angular 19 | `provideAppInitializer(() => inject(AuthService).init())` |
| F7 | `frontend/src/index.html:2,5` | `lang="en"` y título "Frontend" en una UI en español | `lang="es"` y un título con el nombre del sistema |
| F8 | `kds-store.service.ts:64`, `ws-event.interface.ts:17` | `changePriority` y `CancelledEvent` no se usan: no hay UI para cancelar ni repriorizar | Decidir si se implementa la UI o se borra el código |

**Riesgo conocido y aceptado:** el token del socket solo se valida en el handshake (`backend/src/realtime/socket.ts:12`). Está documentado con un comentario `ponytail:`. Un socket ya abierto sigue recibiendo eventos aunque el token haya vencido. Como el socket es de solo lectura, se acepta.

---

## Plan de acción

Cada arreglo que no sea trivial deja **un test** que falle si el bug vuelve.

### Fase 1: bugs que rompen el flujo o exponen datos (prioridad inmediata)
| # | Tarea | Archivos | Test que se añade |
|---|---|---|---|
| 1 | B1: quitar el TTL de `READY` | `order.service.ts`, `prisma-order.repository.ts`, `domain/order.ts`, `in-memory-order-repository.ts` | Un pedido READY con `readyAt` de hace 10 min sigue en `GET /kitchen/orders` |
| 2 | B3: mapear los errores 4xx de body-parser | `error.middleware.ts` | JSON malformado → 400, body de 200 KB → 413 |
| 3 | B2: `P2002` → `DuplicateDisplayCodeError` (409) | `prisma-order.repository.ts`, `error.middleware.ts`, `in-memory-order-repository.ts` | Crear dos veces `#P-1` → 409 |
| 4 | B4: `trim()` en `env.ts` y reutilizarlo en `lambda.ts` | `config/env.ts`, `lambda.ts` | — (una línea) |
| 5 | SEC1: `AUTH_ISSUER` obligatorio al desplegar y build de producción sin mock | `backend/serverless.yml`, `frontend/angular.json`, `environments/*` | Comprobar en el bundle de `ng build` que no aparece `uptc2025` |
| 6 | INF3: corregir la ruta del `.bat` | `iniciar-keycloak.bat` | Ejecución manual |

### Fase 2: consistencia entre pantallas y seguridad del servicio Python
| # | Tarea | Archivos |
|---|---|---|
| 7 | B7 + F5: `version` en `priority_changed`, *upsert* y descartar eventos viejos | `events.ts`, `order.service.ts`, `ws-event.interface.ts`, `kds-store.service.ts` |
| 8 | F1: feedback de error, botones según rol y anti doble clic | `kds-store.service.ts`, `tarjeta-pedido.component.*`, `tablero-kds.component.*` |
| 9 | F2 + F3: refrescar el token en el interceptor y reconectar el socket tras un rechazo | `auth.interceptor.ts`, `socket.service.ts` |
| 10 | F4: `reset()` del store al cerrar sesión | `kds-store.service.ts`, `auth.service.ts` |
| 11 | B5: `userId` en la auditoría | `kitchen.controller.ts`, `order.service.ts`, `domain/order.ts`, ambos repositorios |
| 12 | B6: bloquear el cambio de prioridad en estados finales | `prisma-order.repository.ts`, `order.service.ts`, repositorio en memoria (+ test 400) |
| 13 | S1: `@requiere_rol` cierra por defecto | `keycloak_middleware.py` (+ test: ruta pública con `@requiere_rol` y sin token → 401) |
| 14 | S2: Keycloak caído → 503 | `keycloak_service.py`, `keycloak_middleware.py`, `tests/test_keycloak_service.py` |
| 15 | S3: Kafka sin `flush` por petición y con backoff tras un fallo | `kafka_producer.py`, `tests/test_kafka_producer.py` |
| 16 | C1: realm y cliente `kds-frontend` versionados con las URIs de logout correctas | `security-service/keycloak/` o una carpeta nueva `keycloak/realms/` |

### Fase 3: infraestructura e higiene del repo
| # | Tarea |
|---|---|
| 17 | INF1: rehacer la tarea ECS de Keycloak (sin `--optimized` o con imagen construida, secretos en SSM, `KC_PROXY_HEADERS`, ALB + TLS). Mientras tanto, `serverless remove` del stack actual |
| 18 | INF2: borrar `keycloak-image/` |
| 19 | R1: sacar `dist-dev/`, `.serverless/` y `keycloak-26.1.4/` de git y actualizar `.gitignore` |

### Fase 4: limpieza (bajas)
| # | Tarea |
|---|---|
| 20 | B8–B11, S4–S7, F6, F7: cada uno es un cambio de 1 a 3 líneas; pueden ir juntos en un solo PR |
| 21 | F8: decidir si se construye la UI de cancelar/repriorizar o se borra el código muerto |

### Al cerrar cada fase
```bash
cd backend && npm test && npx tsc --noEmit
cd frontend && npx ng test --watch=false && npx ng build
cd security-service && python -m pytest
graphify update .
```

---

## Estado de aplicación (2026-10-08)

**Aplicados y verificados:** B1–B11, F1–F7, S1–S7, C1, INF1 (plantilla), INF2, INF3, R1.

**Hallazgo nuevo durante el despliegue — S8:** kafka-python 3.x tiene `bootstrap_timeout_ms` de 30 s por defecto y no se configuraba. Con Kafka caído, cada intento de conexión bloqueaba la petición 30 s. Ahora usa `KAFKA_SEGUNDOS_ESPERA` (`kafka_producer.py`).

**Actualización posterior (2026-10-09):**
- **INF1 resuelto:** Keycloak corre en ECS Fargate detrás de CloudFront (`infra/keycloak-ecs.yml`, `scripts/deploy-keycloak-aws.mjs`).
- **SEC1 resuelto para las empresas:** hay una Lambda por empresa (`--stage starpizza` / `delarosepizza`) con `AUTH_ISSUER` apuntando a su realm,
  y los builds de producción de cada empresa ya no incluyen el login de prueba. La API de **dev** sigue sin autenticación a propósito.
- **S9 (nuevo, solo visible en AWS):** con Keycloak en otro sitio, `keycloak-js` pedía refrescar el token con `refresh_token=undefined` (el iframe de sesión
  devolvía "changed" por las cookies de terceros bloqueadas) y el código de refresco (F2) mandaba a `login()` en bucle. Corregido con `checkLoginIframe: false`
  y `check-sso` por redirección.

**Pendientes (requieren una decisión):**
- **B2:** la unicidad de `displayCode` sigue siendo global dentro de cada empresa; falta decidir si debe ser por día.
- **F8:** sin UI de cancelar ni repriorizar.
- Cambiar las contraseñas demo y rotar la clave de AWS usada en el desarrollo.
- Keycloak persistente (RDS) si se necesitan usuarios creados desde la consola.

**Verificación:**
| Qué | Resultado |
|---|---|
| Backend `vitest` + `tsc` | 26/26 (5 nuevos) |
| Frontend `ng test` + build de las 5 configuraciones | 8/8 (3 nuevos), builds OK |
| Security-service `pytest` | todos OK (5 nuevos) |
| E2E local (Postgres + Keycloak + Kafka reales en Docker) | 24/24 checks: B1–B7, B10, S3, S6, auth y roles |
| Keycloak caído | security-service → 503 (S2); backend → 500 |
| Kafka caído | 1 petición de 5 s cada 30 s y el resto en ~1 ms (antes eran 30 s en cada petición); reconecta solo cuando Kafka vuelve |
| Kafka real | eventos entregados (confirmados por callback); el `pedido_id` del evento coincide con la respuesta (S4); `ver_eventos --max 3` lee 3 (S5) |
