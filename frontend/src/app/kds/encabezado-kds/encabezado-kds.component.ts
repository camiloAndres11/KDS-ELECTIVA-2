import { Component, Input, OnDestroy, OnInit, signal, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-encabezado-kds',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './encabezado-kds.component.html',
  styleUrl: './encabezado-kds.component.css',
})
export class EncabezadoKdsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) nombreEmpresa!: string;
  @Input({ required: true }) conectado!: boolean;
  @Input({ required: true }) tiempoRealActivo!: boolean;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly ahora = signal(new Date());
  private intervalId?: ReturnType<typeof setInterval>;

  readonly hora = computed(() =>
    this.ahora().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  );

  readonly usuario = this.auth.usuario;
  readonly roles = computed(() => this.usuario()?.roles.join(', ') ?? '');
  readonly puedeSimular = computed(
    () => this.auth.hasRole('POS_SYSTEM') || this.auth.hasRole('ADMIN'),
  );

  ngOnInit(): void {
    this.intervalId = setInterval(() => this.ahora.set(new Date()), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }

  salir(): void {
    this.auth.logout();
    if (environment.auth.provider === 'mock') {
      void this.router.navigate(['/auth/login']);
    }
  }
}
