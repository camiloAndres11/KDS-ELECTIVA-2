import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { OrderService } from '../../src/services/order.service.js';
import { NOOP_EMITTER } from '../../src/realtime/events.js';
import { InMemoryOrderRepository } from '../support/in-memory-order-repository.js';

function buildApp(): Express {
  const service = new OrderService(new InMemoryOrderRepository(), NOOP_EMITTER);
  return createApp(service, { tenantId: 'test', corsOrigins: ['*'] });
}

const samplePayload = {
  displayCode: '#P-1',
  channel: 'TAKEAWAY',
  priority: 'VIP',
  customerName: 'Juan',
  items: [{ productName: 'Pizza Pepperoni', quantity: 1 }],
};

describe('API REST de cocina', () => {
  let app: Express;

  beforeEach(() => {
    app = buildApp();
  });

  it('crea un pedido y lo lista como activo', async () => {
    const created = await request(app).post('/api/v1/orders').send(samplePayload).expect(201);
    expect(created.body.status).toBe('PENDING');
    expect(created.body.version).toBe(1);

    const active = await request(app).get('/api/v1/kitchen/orders').expect(200);
    expect(active.body).toHaveLength(1);
    expect(active.body[0].displayCode).toBe('#P-1');
  });

  it('rechaza un pedido sin items (422)', async () => {
    await request(app)
      .post('/api/v1/orders')
      .send({ ...samplePayload, items: [] })
      .expect(422);
  });

  it('cambia de PENDING a IN_PREPARATION y sube la versión', async () => {
    const created = await request(app).post('/api/v1/orders').send(samplePayload).expect(201);
    const updated = await request(app)
      .patch(`/api/v1/kitchen/orders/${created.body.id}/status`)
      .send({ status: 'IN_PREPARATION', version: 1 })
      .expect(200);
    expect(updated.body.status).toBe('IN_PREPARATION');
    expect(updated.body.version).toBe(2);
    expect(updated.body.startedAt).not.toBeNull();
  });

  it('rechaza saltarse la máquina de estados (400)', async () => {
    const created = await request(app).post('/api/v1/orders').send(samplePayload).expect(201);
    await request(app)
      .patch(`/api/v1/kitchen/orders/${created.body.id}/status`)
      .send({ status: 'DISPATCHED', version: 1 })
      .expect(400);
  });

  it('responde 404 sobre un pedido inexistente', async () => {
    await request(app)
      .patch('/api/v1/kitchen/orders/no-existe/status')
      .send({ status: 'IN_PREPARATION', version: 1 })
      .expect(404);
  });

  it('detecta el conflicto de versión cuando dos pantallas pisan el mismo pedido', async () => {
    const created = await request(app).post('/api/v1/orders').send(samplePayload).expect(201);
    const [a, b] = await Promise.all([
      request(app).patch(`/api/v1/kitchen/orders/${created.body.id}/status`).send({ status: 'IN_PREPARATION', version: 1 }),
      request(app).patch(`/api/v1/kitchen/orders/${created.body.id}/status`).send({ status: 'IN_PREPARATION', version: 1 }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });
});
