import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TemporizadorComponent } from '../temporizador/temporizador.component';
import type { Order, OrderStatus } from '../../interfaces/order.interface';

const CHANNEL_LABEL: Record<Order['channel'], string> = {
  DINE_IN: 'En local',
  TAKEAWAY: 'Para llevar',
  DELIVERY: 'Domicilio',
};

export interface AccionColumna {
  etiqueta: string;
  siguienteEstado: OrderStatus;
}

@Component({
  selector: 'app-tarjeta-pedido',
  standalone: true,
  imports: [TemporizadorComponent],
  templateUrl: './tarjeta-pedido.component.html',
  styleUrl: './tarjeta-pedido.component.css',
})
export class TarjetaPedidoComponent {
  @Input({ required: true }) pedido!: Order;
  @Input({ required: true }) accion!: AccionColumna | null;
  @Output() cambiarEstado = new EventEmitter<OrderStatus>();

  get canalEtiqueta(): string {
    return CHANNEL_LABEL[this.pedido.channel];
  }
}
