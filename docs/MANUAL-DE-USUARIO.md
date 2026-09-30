# Manual de usuario y guía de despliegue — KDS Pizzerías

Manual del **frontend Angular multitenant** (rama `juan-frontend-angular`) para el
equipo del proyecto KDS-ELECTIVA-2.

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

**Nota:** en Lambda no hay Socket.IO. El frontend ya lo contempla: usa **polling
cada 10 s** (`pollingMs`) y muestra "Actualización automática (HTTP)" en el encabezado.

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

---

## 3. URLs y credenciales (entornos de prueba actuales)

### Local (modo mock, sin Keycloak)

| Frente | URL | Usuarios | Clave |
|---|---|---|---|
| Desarrollo (contra AWS) | http://localhost:4200 | `admin` · `cocinero` · `despachador` · `pos` | `uptc2025` (todos) |
| StarPizza (demo local) | http://localhost:4300 | `admin` · `cocinero` | `uptc2025` |
| Delarose Pizza (demo local) | http://localhost:4400 | `admin` · `cocinero` | `uptc2025` |

### Infraestructura

| Servicio | URL | Credencial |
|---|---|---|
| Backend AWS del equipo | https://vtl24350ra.execute-api.us-east-1.amazonaws.com | `GET /health` → `tenant: dev` |
| Keycloak local | http://localhost:8080 | `admin` / `admin` |
| Backend local dev | http://localhost:3000 | solo desarrollo |
| Backend local StarPizza | http://localhost:3001 | `tenant: starpizza` |
| Backend local Delarose | http://localhost:3002 | `tenant: delarosepizza` |
| Postgres (Docker) | localhost:5433 | `kds` / `kds` |

> Modo mock: `auth.provider: 'mock'` (solo en environments de desarrollo). Los
> environments de empresa (`starpizza`/`delarosepizza`) usan Keycloak real.

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
- [ ] (Keycloak) Un usuario de un realm no entra al otro frente.

## 6. Comandos útiles

```bash
# Frontend
cd frontend
ng serve                                # default (contra backend AWS, mock)
ng serve -c starpizza-local --port 4300 # demo local aislada
ng serve -c delarosepizza-local --port 4400
ng build -c starpizza                   # producción StarPizza
ng build -c delarosepizza               # producción Delarose

# Backend local (por empresa)
cd backend && npm run build
node --env-file=.env dist/server.js                   # :3000 (dev)
node --env-file=.env.starpizza dist/server.js         # :3001
node --env-file=.env.delarosepizza dist/server.js     # :3002

# Infraestructura local
docker compose up -d   # Keycloak :8080
# Postgres: contenedor kds-postgres en :5433
```
