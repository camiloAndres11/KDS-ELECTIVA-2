import { Injectable, computed, signal } from '@angular/core';
import { KdsService } from './kds.service';
import { SocketService } from '../core/realtime/socket.service';
import { environment } from '../../environments/environment';
import type { Order, OrderPriority, OrderStatus } from '../interfaces/order.interface';
import type { PriorityChangedEvent, StatusChangedEvent } from '../interfaces/ws-event.interface';

const PRIORITY_RANK: Record<OrderPriority, number> = { VIP: 0, HIGH: 1, NORMAL: 2 };

@Injectable({ providedIn: 'root' })
export class KdsStoreService {
  private readonly _orders = signal<Order[]>([]);
  readonly orders = this._orders.asReadonly();

  readonly pending = computed(() => this.byStatus('PENDING'));
  readonly inPreparation = computed(() => this.byStatus('IN_PREPARATION'));
  readonly ready = computed(() => this.byStatus('READY'));

  private inicializado = false;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(
    private api: KdsService,
    private socket: SocketService,
  ) {}

  init(): void {
    if (this.inicializado) {
      return;
    }
    this.inicializado = true;

    if (environment.realtimeEnabled) {
      this.socket.connect();
      this.socket.on<void>('connect').subscribe(() => this.reload());
      this.socket.on<Order>('order:created').subscribe((order) => {
        this._orders.update((list) => [order, ...list]);
      });
      this.socket.on<StatusChangedEvent>('order:status_changed').subscribe((event) => {
        this._orders.update((list) =>
          list.map((o) => (o.id === event.orderId ? { ...o, status: event.newStatus, version: event.version } : o)),
        );
      });
      this.socket.on<PriorityChangedEvent>('order:priority_changed').subscribe((event) => {
        this._orders.update((list) => list.map((o) => (o.id === event.orderId ? { ...o, priority: event.priority } : o)));
      });
    }

    this.reload();
    this.intervalId = setInterval(() => this.reload(), environment.pollingMs);
  }

  reload(): void {
    this.api.getActiveOrders().subscribe((orders) => this._orders.set(orders));
  }

  changeStatus(order: Order, status: OrderStatus): void {
    this.api.changeStatus(order.id, status, order.version).subscribe({
      next: (actualizado) => this.aplicarActualizacion(actualizado),
      error: () => this.reload(),
    });
  }

  changePriority(order: Order, priority: OrderPriority): void {
    this.api.changePriority(order.id, priority, order.version).subscribe({
      next: (actualizado) => this.aplicarActualizacion(actualizado),
      error: () => this.reload(),
    });
  }

  private aplicarActualizacion(actualizado: Order): void {
    this._orders.update((list) => list.map((o) => (o.id === actualizado.id ? actualizado : o)));
  }

  private byStatus(status: OrderStatus): Order[] {
    return this._orders()
      .filter((o) => o.status === status)
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt));
  }
}
