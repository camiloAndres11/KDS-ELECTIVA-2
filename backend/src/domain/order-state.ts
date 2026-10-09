import type { OrderStatus } from './order.js';

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['IN_PREPARATION', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'CANCELLED'],
  READY: ['DISPATCHED'],
  DISPATCHED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Estados desde los que SÍ se puede llegar a `to`. Se usa como filtro atómico junto al optimistic lock. */
export function statusesThatCanReach(to: OrderStatus): OrderStatus[] {
  return (Object.keys(TRANSITIONS) as OrderStatus[]).filter((from) => canTransition(from, to));
}

/** Estados que aún admiten cambios (no finales). Son los que muestra el KDS. */
export const ACTIVE_STATUSES = (Object.keys(TRANSITIONS) as OrderStatus[]).filter((s) => TRANSITIONS[s].length > 0);
