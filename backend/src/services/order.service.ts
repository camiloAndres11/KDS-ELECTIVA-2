import type { CreateOrderInput, Order, OrderPriority, OrderRepository, OrderStatus } from '../domain/order.js';
import { ACTIVE_STATUSES, statusesThatCanReach } from '../domain/order-state.js';
import { InvalidTransitionError, NotFoundError, VersionConflictError } from '../domain/errors.js';
import type { OrderEventEmitter } from '../realtime/events.js';

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
    return this.repo.findActiveForKds();
  }

  async changeStatus(orderId: string, newStatus: OrderStatus, expectedVersion: number, userId: string | null = null): Promise<Order> {
    const current = await this.repo.findById(orderId);
    if (!current) throw new NotFoundError('Order', orderId);

    // Version Y transición válida se verifican en UNA sola escritura atómica (ver OrderRepository.updateStatus):
    // así el resultado no depende de una lectura previa que otra pantalla pudo haber dejado obsoleta.
    const allowedFrom = statusesThatCanReach(newStatus);
    const updated = await this.repo.updateStatus(orderId, newStatus, expectedVersion, allowedFrom, current.status, userId);
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

  async changePriority(orderId: string, priority: OrderPriority, expectedVersion: number, userId: string | null = null): Promise<Order> {
    const current = await this.repo.findById(orderId);
    if (!current) throw new NotFoundError('Order', orderId);

    // Un pedido despachado o cancelado ya no cambia de prioridad.
    const updated = await this.repo.updatePriority(orderId, priority, expectedVersion, ACTIVE_STATUSES, current.priority, userId);
    if (!updated) {
      const latest = await this.repo.findById(orderId);
      if (!latest) throw new NotFoundError('Order', orderId);
      if (latest.version !== expectedVersion) throw new VersionConflictError(orderId);
      throw new InvalidTransitionError(latest.status, `prioridad ${priority}`);
    }

    this.events.orderPriorityChanged({ orderId: updated.id, priority: updated.priority, version: updated.version });
    return updated;
  }
}
