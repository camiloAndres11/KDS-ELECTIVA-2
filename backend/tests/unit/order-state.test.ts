import { describe, it, expect } from 'vitest';
import { canTransition } from '../../src/domain/order-state.js';
import type { OrderStatus } from '../../src/domain/order.js';

const STATUSES: OrderStatus[] = ['PENDING', 'IN_PREPARATION', 'READY', 'DISPATCHED', 'CANCELLED'];

describe('canTransition', () => {
  it('sigue el flujo feliz PENDING -> IN_PREPARATION -> READY -> DISPATCHED', () => {
    expect(canTransition('PENDING', 'IN_PREPARATION')).toBe(true);
    expect(canTransition('IN_PREPARATION', 'READY')).toBe(true);
    expect(canTransition('READY', 'DISPATCHED')).toBe(true);
  });

  it('permite cancelar solo antes de READY', () => {
    expect(canTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(canTransition('IN_PREPARATION', 'CANCELLED')).toBe(true);
    expect(canTransition('READY', 'CANCELLED')).toBe(false);
  });

  it('rechaza saltarse pasos', () => {
    expect(canTransition('PENDING', 'READY')).toBe(false);
    expect(canTransition('PENDING', 'DISPATCHED')).toBe(false);
  });

  it('DISPATCHED y CANCELLED son estados finales', () => {
    for (const to of STATUSES) {
      expect(canTransition('DISPATCHED', to)).toBe(false);
      expect(canTransition('CANCELLED', to)).toBe(false);
    }
  });
});
