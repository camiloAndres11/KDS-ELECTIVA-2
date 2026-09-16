import type { Order, OrderPriority, OrderStatus } from '../domain/order.js';

export interface StatusChangedEvent {
  orderId: string;
  displayCode: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  version: number;
  changedAt: string;
}

export interface PriorityChangedEvent {
  orderId: string;
  priority: OrderPriority;
}

/** A dónde manda el servicio de pedidos sus eventos de dominio. Socket.IO es una implementación; los tests usan otra. */
export interface OrderEventEmitter {
  orderCreated(order: Order): void;
  orderStatusChanged(event: StatusChangedEvent): void;
  orderPriorityChanged(event: PriorityChangedEvent): void;
}

export const NOOP_EMITTER: OrderEventEmitter = {
  orderCreated() {},
  orderStatusChanged() {},
  orderPriorityChanged() {},
};
