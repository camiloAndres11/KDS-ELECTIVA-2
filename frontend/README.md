# Frontend — KDS Pizzerías (Angular 21)

Frontend del Kitchen Display System. Consume la API REST y los eventos de Socket.IO
del backend (`backend/`) y aplica los temas del curso: **Keycloak como middleware de
identidad**, **ruteo con lazy loading** y **multi-tenencia por compilación**.

## Arquitectura

```
src/app/
├── app.routes.ts            # rutas raíz: /auth y /kds (lazy)
├── app.config.ts            # router + HttpClient + interceptor + init de auth
├── core/
│   ├── auth/                # KeycloakService, AuthService, guardas
│   ├── interceptors/        # auth.interceptor (Authorization: Bearer)
│   └── realtime/            # socket.service (Socket.IO con token en el handshake)
├── interfaces/              # Order, OrderItem, CreateOrderInput, User, ws-events
├── auth/                    # módulo lazy: pantalla de login
│   └── login/
└── kds/                     # módulo lazy: el tablero
    ├── tablero-kds/         # 3 columnas: Pendientes / En preparación / Listos
    ├── encabezado-kds/      # marca de la empresa, usuario/roles, POS, logout, conexión
    ├── columna-pedidos/ · tarjeta-pedido/ · temporizador/
    ├── pos/                 # simulador POS (crea pedidos vía POST /api/v1/orders)
    ├── kds.service.ts       # HTTP hacia /api/v1
    └── kds-store.service.ts # estado con signals + eventos del socket
```

### Rutas y lazy loading

| Ruta | Carga | Acceso |
|---|---|---|
| `/auth/login` | lazy (`login-component`) | público |
| `/kds` | lazy (`tablero-kds-component`) | `authGuard` (sesión activa) |
| `/kds/pos` | lazy (`pos-component`) | roles `POS_SYSTEM` o `ADMIN` |

### Autenticación (Keycloak)

- `AuthService` inicializa Keycloak con `check-sso` (PKCE) al arrancar la app
  (`APP_INITIALIZER`), así las recargas no pierden la sesión.
- Los roles se leen de `realm_access.roles` y `resource_access[clientId].roles`
  y se filtran contra `auth.roles` del environment.
- `auth.interceptor.ts` agrega `Authorization: Bearer <token>` solo a peticiones
  hacia `apiUrl` (semana 04 del curso).
- `socket.service` envía el token en el handshake de Socket.IO (`auth: { token }`),
  listo para la fase de autenticación del socket en el backend.
- El logout redirige a Keycloak y vuelve a `/auth/login`.

### Multi-tenencia (semana 07 del curso)

Un mismo código y un mismo backend, vendido a **dos empresas clientes distintas**
(como el ejemplo UPTC/Univalle del profesor). Cada empresa se compila con su propio
`environment` mediante `fileReplacements` en `angular.json`, y el backend (el mismo
código) se despliega por separado para cada una con su `TENANT_ID`:

| Empresa (config) | Archivo de entorno | apiUrl | Realm Keycloak | Tema |
|---|---|---|---|---|
| (por defecto) | `environment.ts` | backend AWS del equipo (`…execute-api.us-east-1…`) | `kds-dev` | rojo |
| `starpizza` | `environment.starpizza.ts` | `https://api.starpizza.kds.example.com` | `kds-starpizza` | dorado/negro |
| `delarosepizza` | `environment.delarosepizza.ts` | `https://api.delarosepizza.kds.example.com` | `kds-delarosepizza` | rosa |
| `starpizza-local` | `environment.starpizza.local.ts` | `http://localhost:3001` | `kds-starpizza` (mock) | dorado/negro |
| `delarosepizza-local` | `environment.delarosepizza.local.ts` | `http://localhost:3002` | `kds-delarosepizza` (mock) | rosa |

```bash
ng serve                       # default: contra el backend AWS del equipo
ng serve -c starpizza          # frontend de StarPizza (producción)
ng serve -c delarosepizza      # frontend de Delarose Pizza (producción)
ng serve -c starpizza-local --port 4300    # demo local aislada (backend local :3001)
ng serve -c delarosepizza-local --port 4400
```

Cada empresa define su `apiUrl`, su realm/cliente de Keycloak, su nombre de marca y
sus colores (aplicados como variables CSS en `App.ngOnInit`). Los usuarios de
StarPizza no existen en el realm de Delarose Pizza y viceversa: aislamiento real,
igual que en el backend (`TENANT_ID` + base de datos y realm propios por empresa).

### Tiempo real y polling

El tablero se actualiza por Socket.IO cuando el backend lo soporta
(`realtimeEnabled: true`, backends locales) y **siempre** se refresca por polling
cada `pollingMs` (10 s por defecto). En AWS Lambda no hay websockets, así que el
environment por defecto usa `realtimeEnabled: false` y solo polling; el encabezado
lo indica con "Actualización automática (HTTP)".

### Modo mock (para desarrollo sin Keycloak)

Si en el environment se cambia `auth.provider` a `'mock'`, el login usa usuarios
locales (`admin`/`uptc2025`, `pos`/`uptc2025`, etc. en `auth.mockUsers` del
environment de dev). El token es un JWT falso en base64, suficiente para probar el
flujo del interceptor mientras no esté configurado el realm.

## Requisitos para login con Keycloak en local

1. Levantar Keycloak (Docker): `docker compose up -d` (puerto `8080`).
2. Crear el realm `kds-dev` y el cliente `kds-frontend` (público, PKCE,
   redirect URI `http://localhost:4200/*` y web origin `http://localhost:4200`).
3. Crear los roles `KITCHEN_OPERATOR`, `DISPATCHER`, `POS_SYSTEM`, `ADMIN` en el
   cliente y asignarlos a los usuarios.

## Desarrollo

```bash
npm install
ng serve
ng test --watch=false
```
