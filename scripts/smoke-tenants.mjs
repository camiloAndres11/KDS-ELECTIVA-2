// Prueba de humo multitenant: aislamiento de tokens, roles y datos entre StarPizza y Delarose.
// Requiere: `docker compose up -d`, y los dos backends en :3001 (starpizza) y :3002 (delarosepizza) con AUTH_ISSUER.
//   node scripts/smoke-tenants.mjs
const KC = 'http://localhost:8081/realms';
const run = Date.now().toString(36).slice(-4).toUpperCase(); // códigos únicos para poder repetir la prueba
const T = { star: { api: 'http://localhost:3001', realm: 'kds-starpizza' }, rose: { api: 'http://localhost:3002', realm: 'kds-delarosepizza' } };
let ok = 0, fail = 0;
const check = (n, c, x = '') => { c ? ok++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  · ' + x : ''}`); };
const token = async (t, u) => { const r = await fetch(`${KC}/${T[t].realm}/protocol/openid-connect/token`, { method: 'POST', body: new URLSearchParams({ client_id: 'kds-frontend', grant_type: 'password', username: u, password: 'uptc2025' }) }); const j = await r.json(); return j.access_token ?? (console.log('  token error', t, u, j), null); };
const api = (t, m, p, tok, body) => fetch(T[t].api + '/api/v1' + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body && JSON.stringify(body) });
const claims = (tok) => JSON.parse(Buffer.from(tok.split('.')[1], 'base64url'));

for (const t of ['star', 'rose']) {
  const h = await (await fetch(T[t].api + '/health')).json();
  check(`${t}: /health dice su tenant`, h.tenant === (t === 'star' ? 'starpizza' : 'delarosepizza'), JSON.stringify(h));
}
const tk = {}; for (const t of ['star', 'rose']) for (const u of ['admin', 'cocinero', 'despachador', 'pos']) tk[t + u] = await token(t, u);
check('los 8 usuarios (4 por realm) obtienen token', Object.values(tk).every(Boolean));
const c = claims(tk.starcocinero);
check('token StarPizza: issuer del realm kds-starpizza', c.iss.endsWith('/realms/kds-starpizza'), c.iss);
check('token StarPizza: rol en resource_access.kds-frontend', c.resource_access?.['kds-frontend']?.roles?.includes('KITCHEN_OPERATOR'), JSON.stringify(c.resource_access?.['kds-frontend']?.roles));

console.log('--- Autenticación por empresa ---');
for (const t of ['star', 'rose']) check(`${t}: sin token → 401`, (await api(t, 'GET', '/kitchen/orders')).status === 401);
check('star: su propio token → 200', (await api('star', 'GET', '/kitchen/orders', tk.starcocinero)).status === 200);
check('rose: su propio token → 200', (await api('rose', 'GET', '/kitchen/orders', tk.rosecocinero)).status === 200);
check('AISLAMIENTO: token de StarPizza en backend Delarose → 401', (await api('rose', 'GET', '/kitchen/orders', tk.starcocinero)).status === 401);
check('AISLAMIENTO: token de Delarose en backend StarPizza → 401', (await api('star', 'GET', '/kitchen/orders', tk.rosecocinero)).status === 401);
check('AISLAMIENTO: admin de StarPizza (mismo nombre) no entra a Delarose → 401', (await api('rose', 'POST', '/orders', tk.staradmin, { displayCode: 'X', channel: 'DINE_IN', items: [{ productName: 'a', quantity: 1 }] })).status === 401);

console.log('--- Roles ---');
const mk = (code) => ({ displayCode: code, channel: 'DINE_IN', priority: 'VIP', items: [{ productName: 'Pizza', quantity: 1 }] });
check('star: cocinero no crea pedidos → 403', (await api('star', 'POST', '/orders', tk.starcocinero, mk(`S0-${run}`))).status === 403);
const so = await api('star', 'POST', '/orders', tk.starpos, mk(`S-${run}`)); const sorder = await so.json();
check('star: pos crea pedido → 201', so.status === 201);
check('star: pos no cambia estados → 403', (await api('star', 'PATCH', `/kitchen/orders/${sorder.id}/status`, tk.starpos, { status: 'IN_PREPARATION', version: 1 })).status === 403);
check('star: despachador cambia estado → 200', (await api('star', 'PATCH', `/kitchen/orders/${sorder.id}/status`, tk.stardespachador, { status: 'IN_PREPARATION', version: 1 })).status === 200);

console.log('--- Datos aislados por empresa ---');
const ro = await api('rose', 'POST', '/orders', tk.rosepos, mk(`R-${run}`)); check('rose: pos crea pedido → 201', ro.status === 201);
const starList = await (await api('star', 'GET', '/kitchen/orders', tk.staradmin)).json();
const roseList = await (await api('rose', 'GET', '/kitchen/orders', tk.roseadmin)).json();
const codes = (l) => l.map((o) => o.displayCode);
check('StarPizza ve su pedido y no el de Delarose', codes(starList).includes(`S-${run}`) && !codes(starList).includes(`R-${run}`));
check('Delarose ve su pedido y no el de StarPizza', codes(roseList).includes(`R-${run}`) && !codes(roseList).includes(`S-${run}`));
check('el mismo displayCode puede existir en las dos empresas', (await api('rose', 'POST', '/orders', tk.rosepos, mk(`S-${run}`))).status === 201);
console.log(`\n${ok} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
