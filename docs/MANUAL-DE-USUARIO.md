# Manual de usuario y guía de despliegue — KDS Pizzerías

Manual del **frontend Angular multitenant** (rama `juan-frontend-angular`) para el
equipo del proyecto KDS-ELECTIVA-2.

> **Desplegar todo desde cero en otro PC (local + AWS): ver [`GUIA-DESPLIEGUE.md`](GUIA-DESPLIEGUE.md).**

---

## 1. Qué se despliega

El producto es un **KDS (Kitchen Display System) para pizzerías**: pantalla de cocina
que muestra pedidos en tiempo real con columnas por estado, prioridades y temporizadores.
Se entrega a **dos empresas clientes** con el mismo código y el mismo backend:

| Empresa | Frontend | Backend (mismo código) | Realm Keycloak |
|---|---|---|---|
| StarPizza | build `-c starpizza` | instancia con `TENANT_ID=starpizza` | `kds-starpizza` |
| Delarose Pizza | build `-c delarosepizza` | instancia con `TENANT_ID=delarosepizza` | `kds-delarosepizza` |
| Desarrollo | `ng serve` (default) | backend AWS del equipo (`dev`) | `kds-dev` (mock por ahora) |

**Aislamiento:** cada empresa tiene su propio realm de Keycloak (usuarios separados),
su propia base de datos y su propio despliegue del backend. Un usuario de StarPizza
no puede entrar al frente de Delarose.

---

## 2. Guía de despliegue paso a paso

### 2.1 Frontend (mi parte — lo que se va a desplegar)

**Requisitos:** Node.js 20.19+ (o 22/24) y acceso al repositorio
`camiloAndres11/KDS-ELECTIVA-2`.

1. **Clonar y ubicarse en la rama:**
   ```bash
   git clone https://github.com/camiloAndres11/KDS-ELECTIVA-2.git
   cd KDS-ELECTIVA-2
   git checkout juan-frontend-angular
   ```

2. **Instalar dependencias:**
   ```bash
   cd frontend
   npm install
   ```

3. **Configurar cada empresa** (ANTES de compilar). Editar:
   - `src/environments/environment.starpizza.ts`
   - `src/environments/environment.delarosepizza.ts`

   Ajustar 3 valores por archivo:
   - `apiUrl`: URL real del backend de ESA empresa (desplegado por Lina con su `TENANT_ID`).
   - `auth.keycloak.url`: URL del Keycloak de esa empresa.
   - `auth.keycloak.realm`: nombre del realm (ya viene `kds-starpizza` / `kds-delarosepizza`).
   - Confirmar `auth.provider: 'keycloak'` (ya viene así en estos archivos).

4. **Compilar (build de producción):**
   ```bash
   ng build -c starpizza        # genera dist/frontend/browser/
   ng build -c delarosepizza
   ```
   > Cada build reemplaza el `environment.ts` por el de su empresa (`fileReplacements`).
   > Verificación rápida: `grep -o "starpizza" dist/frontend/browser/*.js` debe devolver resultados.

5. **Publicar el contenido de `dist/frontend/browser/`** en cualquier hosting estático
   (Vercel, Netlify, Cloudflare Pages, S3+CloudFront). **Importante:** configurar el
   fallback de rutas SPA → todas las rutas sirven `index.html` (si no, `/kds` da 404
   al recargar).

6. **CORS:** pedir que el backend de cada empresa incluya el dominio del frontend en
   su `CORS_ORIGINS` (ej. `https://starpizza.example.com`). Sin esto, el navegador
   bloquea las peticiones.

### 2.2 Backend por empresa (parte de Lina)

El backend ya está en AWS Lambda (Serverless). Para cada empresa se despliega una
instancia del mismo código con:
- `TENANT_ID=starpizza` o `delarosepizza`
- `DATABASE_URL` propia (Postgres de Neon, una BD por empresa)
- `CORS_ORIGINS` con el dominio del frontend correspondiente

Despliegue de una empresa (crea su propio stack `kds-backend-api-<empresa>` y su propia URL; el stack `dev` no se toca):
```bash
cd backend && npm run build
# 1) migrar su BD de Neon (una vez, y tras cada migración nueva)
DATABASE_URL='<url de la BD kds_starpizza>' npx prisma migrate deploy
# 2) desplegar la Lambda (credenciales de AWS en el entorno)
TENANT_ID=starpizza \
DATABASE_URL='<url de la BD kds_starpizza>' \
CORS_ORIGINS='https://<dominio-frontend>,http://localhost:4300' \
AUTH_ISSUER='https://d34c6bytkv46ib.cloudfront.net/realms/kds-starpizza' \
AUTH_CLIENT_ID=kds-frontend \
npx serverless deploy --stage starpizza        # igual para delarosepizza (realm kds-delarosepizza)
```
La URL que imprime `serverless deploy` es el `apiUrl` de `environment.<empresa>.ts`.

**Nota:** en Lambda no hay Socket.IO. El frontend ya lo contempla: usa **polling
cada 10 s** (`pollingMs`) y muestra "Actualización automática (HTTP)" en el encabezado.

#### Probar los frontends de producción contra AWS (Keycloak AWS + Lambdas)

`ng build -c starpizza` / `-c delarosepizza` ya apuntan a las Lambdas y al Keycloak de AWS. En local, sirve el resultado
como lo haría un hosting (con *fallback* de rutas a `index.html`) en los puertos que el realm ya permite:
```bash
cd frontend && ng build -c starpizza --output-path dist/starpizza     # frontend en http://localhost:4300
cd frontend && ng build -c delarosepizza --output-path dist/delarose  # frontend en http://localhost:4400
# servir dist/<empresa>/browser con cualquier servidor estático con fallback SPA
```
> No uses `ng serve` con `--poll` sobre `/mnt/c` para probar el login: recompila por cambios falsos y **recarga la página en
> pleno login**; Keycloak rechaza el segundo canje del mismo código (400) y parece un bucle de login.

Las Lambdas aceptan por CORS `http://localhost:4300` / `:4400`. Al publicar un frontend con dominio real: añadir el dominio
a `CORS_ORIGINS` de su Lambda (y volver a desplegar) y a `redirectUris`/`webOrigins` de su realm.

### 2.3 Keycloak por empresa (parte de Luis)

Para cada empresa, en el Keycloak correspondiente:
1. Crear el realm (`kds-starpizza`, `kds-delarosepizza`).
2. Crear el cliente `kds-frontend`:
   - **Client authentication: OFF** (público)
   - **Standard flow: ON**, **PKCE: S256**
   - **Valid redirect URIs:** `https://<dominio-frontend>/*` (y `http://localhost:4200/*` si se prueba en local)
   - **Web origins:** `https://<dominio-frontend>`
3. Crear los roles de cliente: `KITCHEN_OPERATOR`, `DISPATCHER`, `POS_SYSTEM`, `ADMIN`.
4. Crear los usuarios de esa empresa y asignarles su rol.

El frontend NO maneja contraseñas: el login redirige a Keycloak, guarda el token y lo
envía como `Authorization: Bearer` en cada petición.

#### Keycloak en AWS (ya desplegado)

Un único Keycloak en **ECS Fargate** sirve los dos realms (`kds-starpizza`, `kds-delarosepizza`) detrás de CloudFront
(HTTPS gratis) y un ALB que solo acepta tráfico de CloudFront. Plantilla: `infra/keycloak-ecs.yml`.

```bash
# desplegar o actualizar (crea el stack `kds-keycloak` en us-east-1; ≈10 min la primera vez)
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... node scripts/deploy-keycloak-aws.mjs
```
- Los realms se importan en cada arranque desde `security-service/keycloak/kds-*-realm.json`; en AWS el login por contraseña directo está desactivado.
- **Los usuarios creados a mano en la consola se pierden si la tarea se reinicia** (BD H2 dentro del contenedor). Para persistir: RDS Postgres.
- Para agregar el dominio real de un frontend, añadirlo a `redirectUris`/`webOrigins` del realm y volver a ejecutar el script.
- Para apagar y dejar de pagar (~US$50/mes): borrar el stack `kds-keycloak` en CloudFormation.

**Importante para el frontend:** con Keycloak en otro sitio (AWS) y el frontend en `localhost` o en su propio dominio, el navegador
bloquea las cookies de terceros del iframe de sesión de Keycloak. Por eso `keycloak.service.ts` usa `checkLoginIframe: false` y
`check-sso` por redirección (sin `silentCheckSsoRedirectUri`). Si se reactivan, el refresco de token falla y el login entra en bucle.

Para que el backend de una empresa use este Keycloak: `AUTH_ISSUER=https://d34c6bytkv46ib.cloudfront.net/realms/kds-<empresa>` y `AUTH_CLIENT_ID=kds-frontend`.

### 2.4 Seguridad del backend (validación JWT / OpenID Connect)

El backend valida el `Authorization: Bearer <JWT>` de Keycloak (firma RS256 vía JWKS, `iss`, `exp`)
en toda `/api/v1/*` y en el handshake de Socket.IO. `/health` sigue público. Se activa por empresa
con variables de entorno del backend (junto a `TENANT_ID`, `DATABASE_URL`, `CORS_ORIGINS`):

| Variable | Ejemplo | Descripción |
|---|---|---|
| `AUTH_ISSUER` | `https://auth.starpizza.kds.example.com/realms/kds-starpizza` | Issuer del realm. **Vacía = API sin autenticación** (así funcionan hoy AWS dev y el login mock). |
| `AUTH_CLIENT_ID` | `kds-frontend` | Cliente cuyos roles se leen (además de los roles de realm). |
| `AUTH_AUDIENCE` | *(opcional)* | Si se define, exige ese `aud` en el token. |

Permisos por rol: crear pedidos (`POST /orders`) → `POS_SYSTEM`/`ADMIN`; ver el tablero → cualquiera de
los 4 roles; cambiar estado/prioridad → `KITCHEN_OPERATOR`/`DISPATCHER`/`ADMIN`. Sin token → 401; sin rol → 403.

> **No activar `AUTH_ISSUER` en un backend al que apunte un frontend en modo `mock`** (p. ej. el de
> desarrollo en AWS): el token mock no es un JWT real y recibiría 401. Solo en backends de empresa con Keycloak.

---

## 3. URLs y credenciales (entornos de prueba actuales)

### Local

| Frente | URL | Login | Usuarios | Clave |
|---|---|---|---|---|
| Desarrollo (contra AWS) | http://localhost:4200 | mock (sin Keycloak) | `admin` · `cocinero` · `despachador` · `pos` | `uptc2025` |
| StarPizza | http://localhost:4300 | **Keycloak**, realm `kds-starpizza` | `admin` · `cocinero` · `despachador` · `pos` | `uptc2025` |
| Delarose Pizza | http://localhost:4400 | **Keycloak**, realm `kds-delarosepizza` | `admin` · `cocinero` · `despachador` · `pos` | `uptc2025` |

Los usuarios de StarPizza y Delarose tienen los mismos nombres pero son cuentas **distintas**
(cada realm tiene las suyas): un token de un realm lo rechaza el backend del otro.

### Infraestructura

| Servicio | URL | Credencial |
|---|---|---|
| Backend AWS del equipo | https://vtl24350ra.execute-api.us-east-1.amazonaws.com | `GET /health` → `tenant: dev` |
| Keycloak AWS (ECS) | https://d34c6bytkv46ib.cloudfront.net | consola `/admin` · usuario `admin` · contraseña: la imprime `scripts/deploy-keycloak-aws.mjs` al crear el stack |
| Keycloak local (Docker) | http://localhost:8081 | consola: `admin` / `admin123` |
| **Backend AWS StarPizza** (Lambda) | https://fy4meajzqd.execute-api.us-east-1.amazonaws.com | `GET /health` → `tenant: starpizza` · BD Neon `kds_starpizza` · realm `kds-starpizza` |
| **Backend AWS Delarose** (Lambda) | https://uovgkcgp5j.execute-api.us-east-1.amazonaws.com | `GET /health` → `tenant: delarosepizza` · BD Neon `kds_delarosepizza` · realm `kds-delarosepizza` |
| Backend local StarPizza | http://localhost:3001 | `GET /health` → `tenant: starpizza` |
| Backend local Delarose | http://localhost:3002 | `GET /health` → `tenant: delarosepizza` |
| Postgres (Docker) | localhost:5433 | `kds` / `kds` · BDs `kds_starpizza`, `kds_delarosepizza` |

> Keycloak usa el **8081** porque el 8080 suele estar ocupado. Si usas `iniciar-keycloak.bat`
> (Keycloak sin Docker) queda en el 8080 con los mismos realms.
>
> Modo mock: `auth.provider: 'mock'` (solo el environment de desarrollo contra AWS). Todos los
> demás (`starpizza`, `delarosepizza` y sus variantes `-local`) usan Keycloak real.

## 4. Rutas de la aplicación

| Ruta | Qué muestra | Acceso |
|---|---|---|
| `/auth/login` | Login (Keycloak o mock) | público |
| `/kds` | Tablero de cocina (3 columnas) | sesión válida |
| `/kds/pos` | Simulador POS (crear pedidos) | `POS_SYSTEM` o `ADMIN` |

## 5. Checklist de pruebas

- [ ] Login correcto/incorrecto y logout.
- [ ] `admin` ve el enlace "Simulador POS"; `cocinero` no.
- [ ] Pedido aparece en Pendientes con código, canal, cliente, ítems y temporizador.
- [ ] VIP se resalta; a 15 min aviso, a 25 min crítico.
- [ ] Flujo Pendientes → En preparación → Listos → Despachar.
- [ ] Dos pestañas: un pedido creado en una aparece en la otra (polling ≤ 10 s).
- [ ] StarPizza y Delarose: distinta marca/colores y **datos aislados** (un pedido de una no aparece en la otra).
- [ ] Con el backend caído: "Actualización automática" sigue sin romperse y el POS muestra error al crear pedidos.
- [ ] (Keycloak) Un usuario de un realm no entra al otro frente (`node scripts/smoke-tenants.mjs` lo comprueba por API).

## 6. Comandos útiles

```bash
# 1) Infraestructura local: Postgres (:5433) + Keycloak (:8081) con los realms importados
docker compose up -d

# 2) Backend por empresa (migrar cada BD la primera vez)
cd backend && npm install && npm run build
cp .env.starpizza.example .env.starpizza && cp .env.delarosepizza.example .env.delarosepizza
DATABASE_URL=postgresql://kds:kds@localhost:5433/kds_starpizza npx prisma migrate deploy
DATABASE_URL=postgresql://kds:kds@localhost:5433/kds_delarosepizza npx prisma migrate deploy
node --env-file=.env.starpizza dist/server.js                # :3001
node --env-file=.env.delarosepizza dist/server.js            # :3002

# 3) Frontend
cd frontend
ng serve                                            # dev contra AWS, login mock (:4200)
ng serve -c starpizza-local --port 4300             # StarPizza + Keycloak
ng serve -c delarosepizza-local --port 4400         # Delarose + Keycloak
ng build -c starpizza                               # producción StarPizza
ng build -c delarosepizza                           # producción Delarose

# 4) Prueba de humo multitenant (tokens, roles y datos aislados) con los dos backends arriba
node scripts/smoke-tenants.mjs
```

> En WSL, si `ng serve` no recompila al editar archivos en `/mnt/c`, añade `--poll 2000`.
> `docker compose down -v` borra las bases de datos de ambas empresas.
