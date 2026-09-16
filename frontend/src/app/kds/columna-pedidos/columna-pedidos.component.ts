import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TarjetaPedidoComponent, type AccionColumna } from '../tarjeta-pedido/tarjeta-pedido.component';
import type { Order, OrderStatus } from '../../interfaces/order.interface';

export interface CambioEstado {
  order: Order;
  status: OrderStatus;
}

@Component({
  selector: 'app-columna-pedidos',
  standalone: true,
  imports: [TarjetaPedidoComponent],
  templateUrl: './columna-pedidos.component.html',
  styleUrl: './columna-pedidos.component.css',
})
export class ColumnaPedidosComponent {
  @Input({ required: true }) titulo!: string;
  @Input({ required: true }) pedidos!: Order[];
  @Input({ required: true }) accion!: AccionColumna;
  @Output() cambiarEstado = new EventEmitter<CambioEstado>();
}
