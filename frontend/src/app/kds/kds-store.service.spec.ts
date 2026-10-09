import { describe, it, expect } from 'vitest';
import { KdsStoreService } from './kds-store.service';
import type { KdsService } from './kds.service';
import type { SocketService } from '../core/realtime/socket.service';
import type { Order } from '../interfaces/order.interface';

const pedido = (version: number, extra: Partial<Order> = {}): Order => ({
  id: 'p1',
  displayCode: '#P-1',
  channel: 'DINE_IN',
  priority: 'NORMAL',
  status: 'PENDING',
  customerName: null,
  notes: null,
  version,
  createdAt: '2026-01-01T00:00:00.000Z',
  startedAt: null,
  readyAt: null,
  dispatchedAt: null,
  items: [],
  ...extra,
});

const nuevoStore = () => new KdsStoreService({} as KdsService, {} as SocketService);

describe('KdsStoreService · consistencia entre pantallas', () => {
  it('no duplica un pedido que llega dos veces (reload + order:created)', () => {
    const store = nuevoStore();
    store.aplicarActualizacion(pedido(1));
    store.aplicarActualizacion(pedido(1));
    expect(store.orders()).toHaveLength(1);
  });

  it('ignora eventos con una versión vieja', () => {
    const store = nuevoStore();
    store.aplicarActualizacion(pedido(3, { status: 'READY' }));
    store.aplicarEvento('p1', 2, { status: 'IN_PREPARATION' });
    expect(store.orders()[0]).toMatchObject({ status: 'READY', version: 3 });
  });

  it('aplica el cambio de prioridad y su versión', () => {
    const store = nuevoStore();
    store.aplicarActualizacion(pedido(1));
    store.aplicarEvento('p1', 2, { priority: 'VIP' });
    expect(store.orders()[0]).toMatchObject({ priority: 'VIP', version: 2 });
  });
});
