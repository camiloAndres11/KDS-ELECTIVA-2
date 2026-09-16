export type OrderStatus = 'PENDING' | 'IN_PREPARATION' | 'READY' | 'DISPATCHED' | 'CANCELLED';
export type OrderPriority = 'NORMAL' | 'HIGH' | 'VIP';
export type ChannelType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

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
