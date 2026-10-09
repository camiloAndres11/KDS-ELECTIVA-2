import { randomUUID } from 'node:crypto';
import type { CreateOrderInput, Order, OrderPriority, OrderRepository, OrderStatus } from '../../src/domain/order.js';
import { ACTIVE_STATUSES } from '../../src/domain/order-state.js';
import { DuplicateDisplayCodeError } from '../../src/domain/errors.js';

const STATUS_TIMESTAMP_FIELD: Partial<Record<OrderStatus, 'startedAt' | 'readyAt' | 'dispatchedAt'>> = {
  IN_PREPARATION: 'startedAt',
  READY: 'readyAt',
  DISPATCHED: 'dispatchedAt',
};

/** Doble de prueba: mismo contrato que PrismaOrderRepository, sin base de datos. Usado en los tests de integración. */
export class InMemoryOrderRepository implements OrderRepository {
  private orders = new Map<string, Order>();

  async create(input: CreateOrderInput): Promise<Order> {
    if ([...this.orders.values()].some((o) => o.displayCode === input.displayCode)) {
      throw new DuplicateDisplayCodeError(input.displayCode);
    }
    const order: Order = {
      id: randomUUID(),
      displayCode: input.displayCode,
      channel: input.channel,
      priority: input.priority ?? 'NORMAL',
      status: 'PENDING',
      customerName: input.customerName ?? null,
      notes: input.notes ?? null,
      version: 1,
      createdAt: new Date().toISOString(),
      startedAt: null,
      readyAt: null,
      dispatchedAt: null,
      items: input.items.map((i) => ({ id: randomUUID(), productName: i.productName, quantity: i.quantity, notes: i.notes ?? null })),
    };
    this.orders.set(order.id, order);
    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async findActiveForKds(): Promise<Order[]> {
    const priorityRank: Record<OrderPriority, number> = { VIP: 0, HIGH: 1, NORMAL: 2 };
    return [...this.orders.values()]
      .filter((o) => ACTIVE_STATUSES.includes(o.status))
      .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.createdAt.localeCompare(b.createdAt));
  }

  async updateStatus(
    id: string,
    newStatus: OrderStatus,
    expectedVersion: number,
    allowedFromStatuses: OrderStatus[],
    _previousStatus: OrderStatus,
    _userId: string | null,
  ): Promise<Order | null> {
    const current = this.orders.get(id);
    if (!current || current.version !== expectedVersion || !allowedFromStatuses.includes(current.status)) return null;
    const timestampField = STATUS_TIMESTAMP_FIELD[newStatus];
    const updated: Order = {
      ...current,
      status: newStatus,
      version: current.version + 1,
      ...(timestampField ? { [timestampField]: new Date().toISOString() } : {}),
    };
    this.orders.set(id, updated);
    return updated;
  }

  async updatePriority(
    id: string,
    priority: OrderPriority,
    expectedVersion: number,
    allowedFromStatuses: OrderStatus[],
    _previousPriority: OrderPriority,
    _userId: string | null,
  ): Promise<Order | null> {
    const current = this.orders.get(id);
    if (!current || current.version !== expectedVersion || !allowedFromStatuses.includes(current.status)) return null;
    const updated: Order = { ...current, priority, version: current.version + 1 };
    this.orders.set(id, updated);
    return updated;
  }
}
