import { randomUUID } from 'node:crypto';
import type { CreateOrderInput, Order, OrderPriority, OrderRepository, OrderStatus } from '../domain/order.js';
import { statusesThatCanReach } from '../domain/order-state.js';
import { InvalidTransitionError, NotFoundError, VersionConflictError } from '../domain/errors.js';
import type { OrderEventEmitter } from '../realtime/events.js';

const READY_TTL_MINUTES = 5;

export class OrderService {
  constructor(
    private readonly repo: OrderRepository,
    private readonly events: OrderEventEmitter,
  ) {}

  async create(input: CreateOrderInput): Promise<Order> {
    const order = await this.repo.create(input);
    this.events.orderCreated(order);
    return order;
  }

  getActiveForKds(): Promise<Order[]> {
    return this.repo.findActiveForKds(READY_TTL_MINUTES);
  }

  async changeStatus(orderId: string, newStatus: OrderStatus, expectedVersion: number): Promise<Order> {
    const current = await this.repo.findById(orderId);
    if (!current) throw new NotFoundError('Order', orderId);

    // Version Y transición válida se verifican en UNA sola escritura atómica (ver OrderRepository.updateStatus):
    // así el resultado no depende de una lectura previa que otra pantalla pudo haber dejado obsoleta.
    const allowedFrom = statusesThatCanReach(newStatus);
    const updated = await this.repo.updateStatus(orderId, newStatus, expectedVersion, allowedFrom, current.status);
    if (!updated) {
      // La escritura falló: releemos solo para decidir qué error mostrar (409 vs 400), no para decidir si escribir.
      const latest = await this.repo.findById(orderId);
      if (!latest) throw new NotFoundError('Order', orderId);
      if (latest.version !== expectedVersion) throw new VersionConflictError(orderId);
      throw new InvalidTransitionError(latest.status, newStatus);
    }

    this.events.orderStatusChanged({
      orderId: updated.id,
      displayCode: updated.displayCode,
      previousStatus: current.status,
      newStatus: updated.status,
      version: updated.version,
      changedAt: new Date().toISOString(),
    });
    return updated;
  }

  async changePriority(orderId: string, priority: OrderPriority, expectedVersion: number): Promise<Order> {
    const current = await this.repo.findById(orderId);
    if (!current) throw new NotFoundError('Order', orderId);

    const updated = await this.repo.updatePriority(orderId, priority, expectedVersion, current.priority);
    if (!updated) throw new VersionConflictError(orderId);

    this.events.orderPriorityChanged({ orderId: updated.id, priority: updated.priority });
    return updated;
  }
}

/** displayCode incremental simple (#P-1, #P-2, ...) para el simulador de pedidos; un POS real manda el suyo. */
export function generateDisplayCode(): string {
  return `#P-${randomUUID().slice(0, 4).toUpperCase()}`;
}
