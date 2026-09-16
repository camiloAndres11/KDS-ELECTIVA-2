import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { createApp } from '../../src/app.js';
import { OrderService } from '../../src/services/order.service.js';
import { createSocketServer } from '../../src/realtime/socket.js';
import { InMemoryOrderRepository } from '../support/in-memory-order-repository.js';

describe('Difusión en tiempo real (Socket.IO)', () => {
  let httpServer: http.Server;
  let client: Socket;
  let baseUrl: string;

  beforeEach(async () => {
    const repo = new InMemoryOrderRepository();
    httpServer = http.createServer();
    const realtime = createSocketServer(httpServer, ['*']);
    const service = new OrderService(repo, realtime);
    const app = createApp(service, { tenantId: 'test', corsOrigins: ['*'], getWsClientCount: realtime.clientCount });
    httpServer.on('request', app);

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://localhost:${port}`;

    client = ioClient(baseUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve) => client.on('connect', () => resolve()));
  });

  afterEach(() => {
    client.close();
    httpServer.close();
  });

  it('avisa a los clientes conectados cuando se crea un pedido', async () => {
    const eventPromise = new Promise((resolve) => client.once('order:created', resolve));
    await request(baseUrl)
      .post('/api/v1/orders')
      .send({ displayCode: '#P-1', channel: 'DINE_IN', items: [{ productName: 'Pizza', quantity: 1 }] })
      .expect(201);
    const payload = (await eventPromise) as { displayCode: string };
    expect(payload.displayCode).toBe('#P-1');
  });

  it('avisa order:status_changed a todas las pantallas cuando cambia el estado', async () => {
    const created = await request(baseUrl)
      .post('/api/v1/orders')
      .send({ displayCode: '#P-2', channel: 'DINE_IN', items: [{ productName: 'Pizza', quantity: 1 }] })
      .expect(201);

    const eventPromise = new Promise((resolve) => client.once('order:status_changed', resolve));
    await request(baseUrl)
      .patch(`/api/v1/kitchen/orders/${created.body.id}/status`)
      .send({ status: 'IN_PREPARATION', version: 1 })
      .expect(200);

    const payload = (await eventPromise) as { newStatus: string; previousStatus: string };
    expect(payload.previousStatus).toBe('PENDING');
    expect(payload.newStatus).toBe('IN_PREPARATION');
  });
});
