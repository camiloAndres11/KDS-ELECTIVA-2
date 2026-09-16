import { Component, Input, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';

type Urgencia = 'normal' | 'warning' | 'critical';

@Component({
  selector: 'app-temporizador',
  standalone: true,
  templateUrl: './temporizador.component.html',
  styleUrl: './temporizador.component.css',
})
export class TemporizadorComponent implements OnInit, OnDestroy {
  @Input({ required: true }) desde!: string;

  private readonly ahora = signal(Date.now());
  private intervalId?: ReturnType<typeof setInterval>;

  readonly minutosTranscurridos = computed(() => (this.ahora() - new Date(this.desde).getTime()) / 60_000);

  readonly etiqueta = computed(() => {
    const totalSegundos = Math.max(0, Math.floor((this.ahora() - new Date(this.desde).getTime()) / 1000));
    const mm = Math.floor(totalSegundos / 60);
    const ss = totalSegundos % 60;
    return `${mm}:${ss.toString().padStart(2, '0')}`;
  });

  readonly urgencia = computed<Urgencia>(() => {
    const min = this.minutosTranscurridos();
    if (min >= environment.criticalMinutes) return 'critical';
    if (min >= environment.warningMinutes) return 'warning';
    return 'normal';
  });

  ngOnInit(): void {
    this.intervalId = setInterval(() => this.ahora.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }
}
