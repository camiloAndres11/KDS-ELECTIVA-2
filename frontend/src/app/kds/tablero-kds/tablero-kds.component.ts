import { Component, OnInit, inject } from '@angular/core';
import { EncabezadoKdsComponent } from '../encabezado-kds/encabezado-kds.component';
import { ColumnaPedidosComponent, type CambioEstado } from '../columna-pedidos/columna-pedidos.component';
import { KdsStoreService } from '../kds-store.service';
import { SocketService } from '../../core/realtime/socket.service';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import type { AccionColumna } from '../tarjeta-pedido/tarjeta-pedido.component';

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

  // inject() y no parámetro del constructor: los campos de abajo lo usan al inicializarse, antes de que corra el constructor.
  private readonly auth = inject(AuthService);

  // Mismos roles que exige el backend para cambiar estado (kitchen.routes.ts); sin rol no hay botón.
  private readonly puedeOperar = ['KITCHEN_OPERATOR', 'DISPATCHER', 'ADMIN'] as const;

  readonly accionPendientes = this.accion('Iniciar preparación', 'IN_PREPARATION');
  readonly accionEnPreparacion = this.accion('Marcar listo', 'READY');
  readonly accionListos = this.accion('Despachar', 'DISPATCHED');

  constructor(
    readonly store: KdsStoreService,
    private socket: SocketService,
  ) {}

  private accion(etiqueta: string, siguienteEstado: AccionColumna['siguienteEstado']): AccionColumna | null {
    return this.puedeOperar.some((rol) => this.auth.hasRole(rol)) ? { etiqueta, siguienteEstado } : null;
  }

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
