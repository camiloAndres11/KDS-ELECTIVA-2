import { describe, it, expect } from 'vitest';
import { TemporizadorComponent } from './temporizador.component';

function conMinutosTranscurridos(minutos: number): TemporizadorComponent {
  const c = new TemporizadorComponent();
  c.desde = new Date(Date.now() - minutos * 60_000).toISOString();
  return c;
}

describe('TemporizadorComponent · urgencia', () => {
  it('es normal antes del umbral de aviso (15 min)', () => {
    expect(conMinutosTranscurridos(5).urgencia()).toBe('normal');
  });

  it('pasa a warning al llegar a 15 min', () => {
    expect(conMinutosTranscurridos(16).urgencia()).toBe('warning');
  });

  it('pasa a critical al llegar a 25 min', () => {
    expect(conMinutosTranscurridos(26).urgencia()).toBe('critical');
  });

  it('formatea la etiqueta como mm:ss', () => {
    expect(conMinutosTranscurridos(2).etiqueta()).toBe('2:00');
  });
});
