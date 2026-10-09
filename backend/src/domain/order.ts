export type OrderStatus = 'PENDING' | 'IN_PREPARATION' | 'READY' | 'DISPATCHED' | 'CANCELLED';
export type OrderPriority = 'NORMAL' | 'HIGH' | 'VIP';
export type ChannelType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
export type UserRole = 'KITCHEN_OPERATOR' | 'DISPATCHER' | 'POS_SYSTEM' | 'ADMIN';

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  notes: string | null;
}

export interface Order {
  id: string;
  displayCode: string;
  channel: ChannelType;
  priority: OrderPriority;
  status: OrderStatus;
  customerName: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  dispatchedAt: string | null;
  items: OrderItem[];
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  orderId: string;
  userId: string | null;
  action: string;
  previousState: string | null;
  newState: string | null;
  createdAt: string;
}

export interface CreateOrderInput {
  displayCode: string;
  channel: ChannelType;
  priority?: OrderPriority;
  customerName?: string | null;
  notes?: string | null;
  items: Array<{ productName: string; quantity: number; notes?: string | null }>;
}

/** Contrato que debe cumplir cualquier fuente de datos de pedidos (Prisma real, o el doble en memoria usado en tests). */
export interface OrderRepository {
  create(input: CreateOrderInput): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  /** Pedidos que todavía no llegaron a un estado final (PENDING, IN_PREPARATION, READY). */
  findActiveForKds(): Promise<Order[]>;
  /**
   * Actualiza el status solo si `expectedVersion` coincide Y el status actual está en `allowedFromStatuses`
   * (ambas condiciones en la misma operación atómica, para no depender de una lectura previa que puede quedar obsoleta).
   * Devuelve null si no se cumplió alguna de las dos condiciones. `userId` queda en la auditoría.
   */
  updateStatus(
    id: string,
    newStatus: OrderStatus,
    expectedVersion: number,
    allowedFromStatuses: OrderStatus[],
    previousStatus: OrderStatus,
    userId: string | null,
  ): Promise<Order | null>;
  /** Igual que updateStatus: version y estado permitido en la misma escritura atómica. */
  updatePriority(
    id: string,
    priority: OrderPriority,
    expectedVersion: number,
    allowedFromStatuses: OrderStatus[],
    previousPriority: OrderPriority,
    userId: string | null,
  ): Promise<Order | null>;
}
