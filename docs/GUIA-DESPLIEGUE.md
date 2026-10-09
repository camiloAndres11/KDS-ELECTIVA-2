# Guía de despliegue — KDS multitenant (otro PC, desde cero)

Esta guía deja funcionando **todo el sistema** en una máquina nueva: entorno local de pruebas y despliegue en AWS.
Los comandos están en **PowerShell (Windows)** y, donde cambia, en **bash**.

---

## 0. Qué se despliega

```
 Navegador ──► Frontend Angular (uno por empresa)  ──► Lambda (uno por empresa) ──► Neon Postgres (una BD por empresa)
      │                                                     │
      └──────────► Keycloak (ECS Fargate, 1 para todos) ◄───┘   valida el JWT con las claves públicas (JWKS)
                   realms: kds-starpizza · kds-delarosepizza
```

| Pieza | Dónde vive | Cómo se despliega | Estado en AWS al escribir esta guía |
|---|---|---|---|
| Keycloak | ECS Fargate + ALB + CloudFront (HTTPS) | `node scripts/deploy-keycloak-aws.mjs` | `https://d34c6bytkv46ib.cloudfront.net` |
| Backend StarPizza | Lambda `kds-backend-api-starpizza` | `npx serverless deploy --stage starpizza` | `https://fy4meajzqd.execute-api.us-east-1.amazonaws.com` |
| Backend Delarose | Lambda `kds-backend-api-delarosepizza` | `npx serverless deploy --stage delarosepizza` | `https://uovgkcgp5j.execute-api.us-east-1.amazonaws.com` |
| Backend dev (sin auth) | Lambda `kds-backend-api-dev` | `npx serverless deploy --stage dev` | `https://vtl24350ra.execute-api.us-east-1.amazonaws.com` |
| Bases de datos | Neon (`kds_starpizza`, `kds_delarosepizza`) | SQL + `prisma migrate deploy` | creadas |
| Frontends | hosting estático (aún sin publicar) | `ng build -c <empresa>` | solo probados en `localhost:4300/4400` |

> **Si ya está desplegado en AWS** (lo de la tabla), en el PC nuevo basta con las secciones 1 y 2 (para desarrollar) y la 7
> (frontends). Las secciones 3–5 solo son necesarias para **recrear** la infraestructura o cambiarla.

### Qué NO está en git (llévalo aparte, nunca lo subas)
| Secreto | Dónde conseguirlo |
|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (usuario IAM `serverless-dev`) | Consola de AWS → IAM. **Rota la clave que se pegó en el chat durante el desarrollo.** |
| Cadena de conexión de Neon (una por empresa) | Consola de Neon → proyecto → *Connection details* (cambia el nombre de la BD al final). |
| Contraseña del admin de Keycloak en AWS | La imprime el script al crear el stack; si se perdió: ECS → tarea → variable `KC_BOOTSTRAP_ADMIN_PASSWORD`. |

---

## 1. Requisitos del PC

| Herramienta | Versión | Para qué |
|---|---|---|
| Git | cualquiera | clonar |
| Node.js | **20.19+** (o 22/24) | Angular 21, backend, scripts |
| Docker Desktop (con Compose v2) | reciente | Postgres y Keycloak locales |
| Python | 3.11+ | solo para `security-service/` (opcional) |
| Cuenta AWS con el usuario IAM `serverless-dev` | — | despliegue (CloudFormation, ECS, EC2/ELB, CloudFront, IAM, Lambda, API Gateway, Logs, S3) |
| Cuenta Neon | — | bases de datos de las empresas |

No hace falta instalar `aws` CLI: los scripts usan el `aws-sdk` que viene en `backend/node_modules`.

```powershell
git clone https://github.com/camiloAndres11/KDS-ELECTIVA-2.git
cd KDS-ELECTIVA-2
git checkout camiloDev          # o la rama que corresponda
cd backend;  npm install;  cd ..
cd frontend; npm install;  cd ..
```

---

## 2. Entorno local completo (sin AWS) — para probar antes de desplegar

Levanta Postgres (puerto 5433), Keycloak (puerto **8081**) con los dos realms importados, y un backend + frontend por empresa.

```powershell
# 2.1 Infraestructura
docker compose up -d                         # kds-postgres (:5433) y kds-keycloak (:8081)
# Keycloak tarda ~1 min. Comprobar:  http://localhost:8081/realms/kds-starpizza  → JSON

# 2.2 Backends (una terminal por empresa)
cd backend
npx prisma generate
npm run build
Copy-Item .env.starpizza.example .env.starpizza
Copy-Item .env.delarosepizza.example .env.delarosepizza
$env:DATABASE_URL='postgresql://kds:kds@localhost:5433/kds_starpizza';      npx prisma migrate deploy
$env:DATABASE_URL='postgresql://kds:kds@localhost:5433/kds_delarosepizza';  npx prisma migrate deploy
Remove-Item Env:DATABASE_URL
node --env-file=.env.starpizza dist/server.js          # :3001  (terminal 1)
node --env-file=.env.delarosepizza dist/server.js      # :3002  (terminal 2)

# 2.3 Frontends (una terminal por empresa)
cd frontend
npx ng serve -c starpizza-local   --port 4300          # http://localhost:4300
npx ng serve -c delarosepizza-local --port 4400        # http://localhost:4400

# 2.4 Prueba de humo automática (tokens, roles y aislamiento de datos)
node scripts/smoke-tenants.mjs                         # debe terminar en "20 PASS · 0 FAIL"
```

En bash: `export DATABASE_URL=...` en lugar de `$env:DATABASE_URL=...` y `cp` en lugar de `Copy-Item`.

**Usuarios** (en cada realm, clave `uptc2025`): `admin`, `cocinero`, `despachador`, `pos`. Consola de Keycloak local: <http://localhost:8081/admin> (`admin` / `admin123`).

> El puerto 8080 suele estar ocupado (p. ej. CVAT/Traefik); por eso Keycloak va en el 8081.
> `iniciar-keycloak.bat` arranca la distribución de `keycloak-26.1.4/` en el 8080, con los mismos realms. Es alternativa a Docker.

---

## 3. Credenciales de AWS en la sesión

Siempre en la **misma terminal** donde vayas a desplegar (no se guardan en ningún archivo):

```powershell
$env:AWS_ACCESS_KEY_ID='<tu-access-key>'
$env:AWS_SECRET_ACCESS_KEY='<tu-secret>'
$env:AWS_REGION='us-east-1'
```
bash: `export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=us-east-1`

---

## 4. Keycloak en AWS (ECS Fargate)

Una sola vez (o para actualizar los realms):

```powershell
node scripts/deploy-keycloak-aws.mjs
```

- **Primera vez (~10 min):** crea el stack CloudFormation `kds-keycloak` (VPC por defecto, ALB, CloudFront, cluster, tarea). Al final imprime
  la **URL pública** (`https://xxxx.cloudfront.net`) y la **contraseña de admin** (solo se muestra una vez: guárdala).
- **Si el stack ya existe:** vuelve a desplegar con la plantilla y los realms actuales (reinicia la tarea) y conserva la contraseña.
- Los realms se importan de `security-service/keycloak/kds-*-realm.json` en cada arranque. En AWS el login por contraseña directo
  (`directAccessGrants`) queda **desactivado**.
- **Limitación:** la BD de Keycloak es H2 dentro del contenedor. Los usuarios creados a mano en la consola se **pierden** si la tarea se reinicia;
  los 4 usuarios de cada realm sí se recrean solos. Para persistir hay que migrar a RDS Postgres.
- **Costo aproximado:** ~US$50/mes (ECS + ALB + CloudFront).

Verificación:
```powershell
curl https://<dominio>.cloudfront.net/realms/kds-starpizza/.well-known/openid-configuration   # 200 y "issuer" con https
curl https://<dominio>.cloudfront.net/realms/kds-delarosepizza/.well-known/openid-configuration
```

Si el dominio de CloudFront **cambia** (stack recreado), actualiza `auth.keycloak.url` en `frontend/src/environments/environment.starpizza.ts`
y `environment.delarosepizza.ts`, y el `AUTH_ISSUER` de cada Lambda (sección 6).

---

## 5. Bases de datos en Neon (una por empresa)

1. En la consola de Neon, abre el **SQL Editor** del proyecto y ejecuta:
   ```sql
   CREATE DATABASE kds_starpizza;
   CREATE DATABASE kds_delarosepizza;
   ```
   (ya existen en el proyecto actual; solo es necesario si usas un proyecto Neon nuevo).
2. Copia la cadena de conexión del proyecto y cambia el nombre de la BD del final por `kds_starpizza` y `kds_delarosepizza`.
3. Aplica las migraciones a cada una:
   ```powershell
   cd backend
   $env:DATABASE_URL='<cadena-neon>/kds_starpizza?sslmode=require'      # usa tus parámetros reales
   npx prisma migrate deploy
   $env:DATABASE_URL='<cadena-neon>/kds_delarosepizza?sslmode=require'
   npx prisma migrate deploy
   ```
   Debe decir `All migrations have been successfully applied`. Repite este paso cada vez que se agregue una migración nueva en `backend/prisma/migrations/`.

---

## 6. Backends en Lambda (uno por empresa)

Cada empresa es **un stack distinto** (`kds-backend-api-<empresa>`) con su propia URL; se despliega con el mismo código cambiando variables.

```powershell
cd backend
npx prisma generate
npm run build                      # compila a dist/

$kc = 'https://<dominio>.cloudfront.net'                     # URL de Keycloak (sección 4)

# --- StarPizza ---
$env:TENANT_ID='starpizza'
$env:DATABASE_URL='<cadena-neon>/kds_starpizza?sslmode=require'
$env:CORS_ORIGINS='http://localhost:4300,https://<dominio-frontend-starpizza>'
$env:AUTH_ISSUER="$kc/realms/kds-starpizza"
$env:AUTH_CLIENT_ID='kds-frontend'
npx serverless deploy --stage starpizza            # imprime la URL de la API  → es el apiUrl del frontend

# --- Delarose ---
$env:TENANT_ID='delarosepizza'
$env:DATABASE_URL='<cadena-neon>/kds_delarosepizza?sslmode=require'
$env:CORS_ORIGINS='http://localhost:4400,https://<dominio-frontend-delarose>'
$env:AUTH_ISSUER="$kc/realms/kds-delarosepizza"
npx serverless deploy --stage delarosepizza
```

- ⚠ **`AUTH_ISSUER` vacío = API sin autenticación.** Solo debe estar vacío en `--stage dev` (el frontend de dev usa login de prueba).
- Cada deploy tarda ~2,5 min. Hay que volver a desplegar si cambia cualquier variable (p. ej. un nuevo dominio en `CORS_ORIGINS`).
- La URL impresa va en `apiUrl` de `frontend/src/environments/environment.<empresa>.ts` (ya está puesta para las Lambdas actuales).

Verificación:
```powershell
curl https://<api-starpizza>/health                  # {"status":"ok","tenant":"starpizza",...}
curl -i https://<api-starpizza>/api/v1/kitchen/orders # 401 (sin token) — correcto
```

Dev (sin auth, contra el que apunta `environment.ts`): quitar `AUTH_ISSUER` y desplegar con `--stage dev`.

---

## 7. Frontends

```powershell
cd frontend
npx ng build -c starpizza        # → frontend/dist/frontend/browser
npx ng build -c delarosepizza    # (cambia --output-path si quieres conservar los dos)
```
Cada build usa su `environment.<empresa>.ts` (marca, `apiUrl` de la Lambda, realm de Keycloak). Verificación: `Select-String "starpizza" dist/frontend/browser/*.js`.

**Publicar** el contenido de `browser/` en cualquier hosting estático (S3 + CloudFront, Netlify, Vercel…) con **fallback SPA**: toda ruta debe servir `index.html`
(si no, recargar `/kds` da 404).

**Al tener dominio real**, hay que registrarlo en tres sitios y volver a desplegar:
1. `CORS_ORIGINS` de su Lambda (sección 6).
2. En su realm (`security-service/keycloak/kds-<empresa>-realm.json`): `redirectUris` (`https://dominio/*`), `webOrigins` (`https://dominio`) y `post.logout.redirect.uris` (valores separados por `##`).
3. Ejecutar de nuevo `node scripts/deploy-keycloak-aws.mjs` (sección 4).

---

## 8. Prueba de extremo a extremo

1. Abre el frontend de StarPizza → **Entrar con Keycloak** → te lleva al Keycloak de AWS.
2. Entra como `pos` / `uptc2025` → **Simulador POS** → crea un pedido → aparece en *Pendientes*.
3. **Salir**, entra como `cocinero` → *Iniciar preparación* → *Marcar listo* → *Despachar*. (`pos` no ve esos botones.)
4. Abre el frontend de Delarose: el pedido de StarPizza **no** aparece (datos aislados). Un token de una empresa recibe **401** en la API de la otra.
5. Recarga la página: la sesión se mantiene. **Salir** vuelve al login y pide credenciales otra vez.

Usuarios (cada realm, clave `uptc2025`): `admin` (todo) · `cocinero` · `despachador` · `pos` (solo crea pedidos).
Consola de Keycloak AWS: `<url-keycloak>/admin` con usuario `admin` y la contraseña de la sección 4 (cuenta del realm `master`: no sirve para entrar a los frontends).

---

## 9. Apagar / limpiar (para dejar de pagar)

```powershell
# Keycloak (borra ECS, ALB, CloudFront): consola de AWS → CloudFormation → stack `kds-keycloak` → Delete
cd backend
npx serverless remove --stage starpizza
npx serverless remove --stage delarosepizza
# Neon: DROP DATABASE kds_starpizza; DROP DATABASE kds_delarosepizza;   (desde el SQL Editor)
docker compose down -v        # local: borra también los datos de Postgres local
```

---

## 10. Problemas conocidos

| Síntoma | Causa | Solución |
|---|---|---|
| El login entra en **bucle** (la página se recarga y vuelve a Keycloak) | Se reactivó `silentCheckSsoRedirectUri` o `checkLoginIframe` en `keycloak.service.ts`: con Keycloak en otro sitio el navegador bloquea las cookies de terceros del iframe de sesión | Dejarlos desactivados (ya lo están). |
| El login "no lleva a ningún lado" probando con `ng serve --poll` | En `/mnt/c` (WSL) el modo `--poll` recompila por cambios falsos y recarga la página en pleno login; Keycloak rechaza el segundo canje del mismo código (400) | Probar con un build servido como estático, o `ng serve` sin `--poll`. |
| `Port 8080 is already in use` / aparece CVAT en el 8080 | Otra herramienta ocupa el puerto | Usar el Keycloak de Docker (8081). |
| La Lambda responde **500** con cualquier token | Su `AUTH_ISSUER` apunta a un Keycloak caído o con otra URL (p. ej. un túnel temporal) | Corregir `AUTH_ISSUER` y volver a desplegar. |
| CORS bloquea el frontend | Falta su origen en `CORS_ORIGINS` de la Lambda | Añadirlo (separado por comas, sin espacios problemáticos) y redeplegar. |
| `serverless deploy` falla por `DATABASE_URL` | Variable no definida en esa terminal | Definir todas las variables de la sección 6 antes de desplegar. |
| Keycloak AWS tarda ~3 min en responder tras reiniciar | Arranque de la tarea Fargate | Esperar; ver logs en CloudWatch (`/ecs/kds-keycloak`). |

---

## 11. Seguridad — pendientes antes de mostrarlo fuera del curso

- **Rotar la clave de AWS** usada durante el desarrollo y desactivar la anterior.
- Las contraseñas demo (`uptc2025`) y los 4 usuarios están en los realms versionados: cambiarlas o eliminar usuarios antes de exponerlo públicamente.
- El realm `kds` y los realms locales tienen `directAccessGrants` activado **solo para pruebas con scripts**; en AWS ya está desactivado.
- La contraseña de admin de Keycloak en AWS es visible en la definición de la tarea de ECS para quien tenga acceso a esa consola. Para compartir la cuenta, pasarla a Secrets Manager.
- La API de **dev** sigue sin autenticación.
