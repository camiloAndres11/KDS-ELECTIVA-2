import { Component, OnInit } from '@angular/core';
import { EncabezadoKdsComponent } from '../encabezado-kds/encabezado-kds.component';
import { ColumnaPedidosComponent, type CambioEstado } from '../columna-pedidos/columna-pedidos.component';
import { KdsStoreService } from '../kds-store.service';
import { SocketService } from '../../core/realtime/socket.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-tablero-kds',
  standalone: true,
  imports: [EncabezadoKdsComponent, ColumnaPedidosComponent],
  templateUrl: './tablero-kds.component.html',
  styleUrl: './tablero-kds.component.css',
})
export class TableroKdsComponent implements OnInit {
  readonly nombreEmpresa = environment.displayName;
  readonly tiempoRealActivo = environment.realtimeEnabled;

  readonly accionPendientes = { etiqueta: 'Iniciar preparación', siguienteEstado: 'IN_PREPARATION' as const };
  readonly accionEnPreparacion = { etiqueta: 'Marcar listo', siguienteEstado: 'READY' as const };
  readonly accionListos = { etiqueta: 'Despachar', siguienteEstado: 'DISPATCHED' as const };

  constructor(
    readonly store: KdsStoreService,
    private socket: SocketService,
  ) {}

  ngOnInit(): void {
    this.store.init();
  }

  get conectado(): boolean {
    return this.socket.connected();
  }

  onCambiarEstado({ order, status }: CambioEstado): void {
    this.store.changeStatus(order, status);
  }
}
