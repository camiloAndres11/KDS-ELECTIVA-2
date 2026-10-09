import type { PrismaClient, Order as PrismaOrder, OrderItem as PrismaOrderItem } from '@prisma/client';
import type { CreateOrderInput, Order, OrderRepository, OrderStatus, OrderPriority } from '../domain/order.js';
import { ACTIVE_STATUSES } from '../domain/order-state.js';
import { DuplicateDisplayCodeError } from '../domain/errors.js';

type PrismaOrderWithItems = PrismaOrder & { items: PrismaOrderItem[] };

function toOrder(row: PrismaOrderWithItems): Order {
  return {
    id: row.id,
    displayCode: row.displayCode,
    channel: row.channel,
    priority: row.priority,
    status: row.status,
    customerName: row.customerName,
    notes: row.notes,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    readyAt: row.readyAt?.toISOString() ?? null,
    dispatchedAt: row.dispatchedAt?.toISOString() ?? null,
    items: row.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      quantity: i.quantity,
      notes: i.notes,
    })),
  };
}

const STATUS_TIMESTAMP_FIELD: Partial<Record<OrderStatus, 'startedAt' | 'readyAt' | 'dispatchedAt'>> = {
  IN_PREPARATION: 'startedAt',
  READY: 'readyAt',
  DISPATCHED: 'dispatchedAt',
};

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateOrderInput): Promise<Order> {
    try {
      const row = await this.db.order.create({
        data: {
          displayCode: input.displayCode,
          channel: input.channel,
          priority: input.priority ?? 'NORMAL',
          customerName: input.customerName ?? null,
          notes: input.notes ?? null,
          items: { create: input.items.map((i) => ({ productName: i.productName, quantity: i.quantity, notes: i.notes ?? null })) },
        },
        include: { items: true },
      });
      return toOrder(row);
    } catch (err) {
      // P2002 = violación de unique; el único unique de `orders` es display_code.
      if ((err as { code?: unknown })?.code === 'P2002') throw new DuplicateDisplayCodeError(input.displayCode);
      throw err;
    }
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.order.findUnique({ where: { id }, include: { items: true } });
    return row ? toOrder(row) : null;
  }

  async findActiveForKds(): Promise<Order[]> {
    const rows = await this.db.order.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      include: { items: true },
      orderBy: [{ createdAt: 'asc' }],
    });
    const priorityRank: Record<OrderPriority, number> = { VIP: 0, HIGH: 1, NORMAL: 2 };
    return rows.map(toOrder).sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  }

  async updateStatus(
    id: string,
    newStatus: OrderStatus,
    expectedVersion: number,
    allowedFromStatuses: OrderStatus[],
    previousStatus: OrderStatus,
    userId: string | null,
  ): Promise<Order | null> {
    const timestampField = STATUS_TIMESTAMP_FIELD[newStatus];
    return this.db.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id, version: expectedVersion, status: { in: allowedFromStatuses } },
        data: {
          status: newStatus,
          version: { increment: 1 },
          ...(timestampField ? { [timestampField]: new Date() } : {}),
        },
      });
      if (result.count === 0) return null;
      await tx.auditLog.create({
        data: { orderId: id, userId, action: 'STATUS_CHANGED', previousState: previousStatus, newState: newStatus },
      });
      const row = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
      return toOrder(row);
    });
  }

  async updatePriority(
    id: string,
    priority: OrderPriority,
    expectedVersion: number,
    allowedFromStatuses: OrderStatus[],
    previousPriority: OrderPriority,
    userId: string | null,
  ): Promise<Order | null> {
    return this.db.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id, version: expectedVersion, status: { in: allowedFromStatuses } },
        data: { priority, version: { increment: 1 } },
      });
      if (result.count === 0) return null;
      await tx.auditLog.create({
        data: { orderId: id, userId, action: 'PRIORITY_CHANGED', previousState: previousPriority, newState: priority },
      });
      const row = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
      return toOrder(row);
    });
  }
}
