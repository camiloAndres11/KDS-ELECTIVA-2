import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Order, OrderPriority, OrderStatus } from '../interfaces/order.interface';

@Injectable({ providedIn: 'root' })
export class KdsService {
  private readonly api = `${environment.apiUrl}/api/v1`;

  constructor(private http: HttpClient) {}

  getActiveOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.api}/kitchen/orders`);
  }

  changeStatus(id: string, status: OrderStatus, version: number): Observable<Order> {
    return this.http.patch<Order>(`${this.api}/kitchen/orders/${id}/status`, { status, version });
  }

  changePriority(id: string, priority: OrderPriority, version: number): Observable<Order> {
    return this.http.patch<Order>(`${this.api}/kitchen/orders/${id}/priority`, { priority, version });
  }
}
