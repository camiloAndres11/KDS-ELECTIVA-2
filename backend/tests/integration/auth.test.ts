import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from 'jose';
import { createApp } from '../../src/app.js';
import { oidcVerifier } from '../../src/middlewares/auth.middleware.js';
import { createSocketServer } from '../../src/realtime/socket.js';
import { OrderService } from '../../src/services/order.service.js';
import { NOOP_EMITTER } from '../../src/realtime/events.js';
import { InMemoryOrderRepository } from '../support/in-memory-order-repository.js';

const ISSUER = 'http://keycloak.test/realms/kds-test';
const CLIENT = 'kds-frontend';
const payload = {
  displayCode: '#A-1',
  channel: 'TAKEAWAY',
  priority: 'NORMAL',
  customerName: 'Ana',
  items: [{ productName: 'Pizza', quantity: 1 }],
};

let privateKey: KeyLike;
let otherKey: KeyLike;
let jwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair('RS256')).privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), alg: 'RS256', use: 'sig' };
});

function sign(claims: Record<string, unknown>, opts: { key?: KeyLike; issuer?: string; exp?: string } = {}) {
  return new SignJWT({ preferred_username: 'tester', ...claims })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(opts.issuer ?? ISSUER)
    .setSubject('user-1')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '5m')
    .sign(opts.key ?? privateKey);
}

const asClientRole = (...roles: string[]) => ({ resource_access: { [CLIENT]: { roles } } });
const asRealmRole = (...roles: string[]) => ({ realm_access: { roles } });
const verifier = () => oidcVerifier({ issuer: ISSUER, clientId: CLIENT }, createLocalJWKSet({ keys: [jwk] }));
const buildApp = (auth = verifier()) =>
  createApp(new OrderService(new InMemoryOrderRepository(), NOOP_EMITTER), { tenantId: 't', corsOrigins: ['*'], auth });

describe('Seguridad JWT / OpenID Connect', () => {
  it('deja /health público', async () => {
    await request(buildApp()).get('/health').expect(200);
  });

  it('rechaza peticiones sin token o con esquema distinto de Bearer (401)', async () => {
    const res = await request(buildApp()).get('/api/v1/kitchen/orders').expect(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    await request(buildApp()).get('/api/v1/kitchen/orders').set('Authorization', 'Basic abc').expect(401);
  });

  it('rechaza tokens firmados con otra clave, vencidos o de otro issuer (401)', async () => {
    const app = buildApp();
    for (const token of [
      await sign(asClientRole('ADMIN'), { key: otherKey }),
      await sign(asClientRole('ADMIN'), { exp: '-1m' }),
      await sign(asClientRole('ADMIN'), { issuer: 'http://evil.test/realms/x' }),
      'esto.no.es-un-jwt',
    ]) {
      await request(app).get('/api/v1/kitchen/orders').set('Authorization', `Bearer ${token}`).expect(401);
    }
  });

  it('acepta roles de cliente y de realm', async () => {
    const app = buildApp();
    for (const claims of [asClientRole('KITCHEN_OPERATOR'), asRealmRole('KITCHEN_OPERATOR')]) {
      const token = await sign(claims);
      await request(app).get('/api/v1/kitchen/orders').set('Authorization', `Bearer ${token}`).expect(200);
    }
  });

  it('ignora roles de otros clientes y rechaza usuarios sin rol KDS (403)', async () => {
    const otherClient = await sign({ resource_access: { otra: { roles: ['ADMIN'] } } });
    await request(buildApp()).get('/api/v1/kitchen/orders').set('Authorization', `Bearer ${otherClient}`).expect(403);
  });

  it('aplica roles por endpoint: solo POS/ADMIN crean pedidos, cocina opera pedidos', async () => {
    const app = buildApp();
    const cook = `Bearer ${await sign(asClientRole('KITCHEN_OPERATOR'))}`;
    const pos = `Bearer ${await sign(asClientRole('POS_SYSTEM'))}`;

    await request(app).post('/api/v1/orders').set('Authorization', cook).send(payload).expect(403);
    const created = await request(app).post('/api/v1/orders').set('Authorization', pos).send(payload).expect(201);

    const patch = { status: 'IN_PREPARATION', version: 1 };
    const url = `/api/v1/kitchen/orders/${created.body.id}/status`;
    await request(app).patch(url).set('Authorization', pos).send(patch).expect(403);
    await request(app).patch(url).set('Authorization', cook).send(patch).expect(200);
  });

  it('si Keycloak no responde no es un 401 sino un error de servidor', async () => {
    const down = oidcVerifier({ issuer: ISSUER, clientId: CLIENT }, () => Promise.reject(new TypeError('fetch failed')));
    const token = await sign(asClientRole('ADMIN'));
    await request(buildApp(down)).get('/api/v1/kitchen/orders').set('Authorization', `Bearer ${token}`).expect(500);
  });

  describe('handshake de Socket.IO', () => {
    let server: http.Server;
    let url: string;

    beforeAll(async () => {
      server = http.createServer();
      createSocketServer(server, ['*'], verifier());
      await new Promise<void>((resolve) => server.listen(0, resolve));
      url = `http://localhost:${(server.address() as { port: number }).port}`;
    });
    afterAll(() => {
      server.close();
    });

    const connect = (token?: string) =>
      new Promise<'connected' | string>((resolve) => {
        const socket = ioClient(url, { transports: ['websocket'], reconnection: false, auth: { token } });
        socket.on('connect', () => (socket.close(), resolve('connected')));
        socket.on('connect_error', (err) => (socket.close(), resolve(err.message)));
      });

    it('rechaza sin token y con token inválido', async () => {
      expect(await connect()).toBe('unauthorized');
      expect(await connect(await sign(asClientRole('ADMIN'), { key: otherKey }))).toBe('unauthorized');
    });

    it('acepta un token válido con rol KDS', async () => {
      expect(await connect(await sign(asClientRole('DISPATCHER')))).toBe('connected');
    });
  });
});
