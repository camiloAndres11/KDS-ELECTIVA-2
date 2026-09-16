import { Component, Input, OnDestroy, OnInit, signal, computed } from '@angular/core';

@Component({
  selector: 'app-encabezado-kds',
  standalone: true,
  templateUrl: './encabezado-kds.component.html',
  styleUrl: './encabezado-kds.component.css',
})
export class EncabezadoKdsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) nombreSucursal!: string;
  @Input({ required: true }) conectado!: boolean;

  private readonly ahora = signal(new Date());
  private intervalId?: ReturnType<typeof setInterval>;

  readonly hora = computed(() =>
    this.ahora().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  );

  ngOnInit(): void {
    this.intervalId = setInterval(() => this.ahora.set(new Date()), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }
}
