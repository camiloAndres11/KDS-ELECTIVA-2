import type { OrderPriority, OrderStatus } from './order.interface';

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

export interface CancelledEvent {
  orderId: string;
}
