import { Injectable, computed, signal } from '@angular/core';
import type { HttpErrorResponse } from '@angular/common/http';
import type { Observable, Subscription } from 'rxjs';
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

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  readonly pending = computed(() => this.byStatus('PENDING'));
  readonly inPreparation = computed(() => this.byStatus('IN_PREPARATION'));
  readonly ready = computed(() => this.byStatus('READY'));

  private inicializado = false;
  private intervalId?: ReturnType<typeof setInterval>;
  private errorTimeoutId?: ReturnType<typeof setTimeout>;
  private suscripciones: Subscription[] = [];
  /** Pedidos con una petición en curso: un doble clic no manda dos PATCH con la misma versión. */
  private readonly enCurso = new Set<string>();

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
      this.suscripciones = [
        this.socket.on<void>('connect').subscribe(() => this.reload()),
        this.socket.on<Order>('order:created').subscribe((order) => this.aplicarActualizacion(order)),
        this.socket.on<StatusChangedEvent>('order:status_changed').subscribe((e) =>
          this.aplicarEvento(e.orderId, e.version, { status: e.newStatus }),
        ),
        this.socket.on<PriorityChangedEvent>('order:priority_changed').subscribe((e) =>
          this.aplicarEvento(e.orderId, e.version, { priority: e.priority }),
        ),
      ];
    }

    this.reload();
    this.intervalId = setInterval(() => this.reload(), environment.pollingMs);
  }

  /** Deja el store como recién creado: se llama al cerrar sesión. */
  reset(): void {
    clearInterval(this.intervalId);
    clearTimeout(this.errorTimeoutId);
    this.suscripciones.forEach((s) => s.unsubscribe());
    this.suscripciones = [];
    this.socket.disconnect();
    this.enCurso.clear();
    this._orders.set([]);
    this._error.set(null);
    this.inicializado = false;
  }

  reload(): void {
    this.api.getActiveOrders().subscribe((orders) => this._orders.set(orders));
  }

  changeStatus(order: Order, status: OrderStatus): void {
    this.enviar(order, this.api.changeStatus(order.id, status, order.version));
  }

  changePriority(order: Order, priority: OrderPriority): void {
    this.enviar(order, this.api.changePriority(order.id, priority, order.version));
  }

  /** Inserta o reemplaza por id; descarta datos más viejos que los que ya tenemos. */
  aplicarActualizacion(actualizado: Order): void {
    this._orders.update((list) => {
      const actual = list.find((o) => o.id === actualizado.id);
      if (!actual) return [actualizado, ...list];
      if (actual.version > actualizado.version) return list;
      return list.map((o) => (o.id === actualizado.id ? actualizado : o));
    });
  }

  /** Aplica un evento parcial solo si trae una versión más nueva que la local. */
  aplicarEvento(orderId: string, version: number, cambios: Partial<Order>): void {
    this._orders.update((list) =>
      list.map((o) => (o.id === orderId && version > o.version ? { ...o, ...cambios, version } : o)),
    );
  }

  private enviar(order: Order, peticion: Observable<Order>): void {
    if (this.enCurso.has(order.id)) {
      return;
    }
    this.enCurso.add(order.id);
    peticion.subscribe({
      next: (actualizado) => {
        this.enCurso.delete(order.id);
        this.aplicarActualizacion(actualizado);
      },
      error: (err: HttpErrorResponse) => {
        this.enCurso.delete(order.id);
        this.mostrarError(this.mensajeDeError(order, err));
        this.reload();
      },
    });
  }

  private mensajeDeError(order: Order, err: HttpErrorResponse): string {
    if (err.status === 0) return 'Sin conexión con el servidor. Intenta de nuevo.';
    if (err.status === 409) return `${order.displayCode} fue modificado en otra pantalla. Se actualizó el tablero.`;
    if (err.status === 401 || err.status === 403) return 'No tienes permisos para esta acción.';
    return err.error?.detail ?? `No se pudo actualizar ${order.displayCode}.`;
  }

  private mostrarError(mensaje: string): void {
    clearTimeout(this.errorTimeoutId);
    this._error.set(mensaje);
    this.errorTimeoutId = setTimeout(() => this._error.set(null), 6000);
  }

  private byStatus(status: OrderStatus): Order[] {
    return this._orders()
      .filter((o) => o.status === status)
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt));
  }
}
