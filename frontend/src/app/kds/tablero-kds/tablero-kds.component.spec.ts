import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach } from 'vitest';
import { TableroKdsComponent } from './tablero-kds.component';
import { AuthService } from '../../core/auth/auth.service';

describe('TableroKdsComponent · botones según rol', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  });

  it('se crea y muestra las acciones a quien puede operar', () => {
    TestBed.inject(AuthService).loginMock('cocinero', 'uptc2025');
    const c = TestBed.createComponent(TableroKdsComponent).componentInstance;
    expect(c.accionPendientes).toEqual({ etiqueta: 'Iniciar preparación', siguienteEstado: 'IN_PREPARATION' });
    expect(c.accionListos?.siguienteEstado).toBe('DISPATCHED');
  });

  it('oculta las acciones a quien solo es POS', () => {
    TestBed.inject(AuthService).loginMock('pos', 'uptc2025');
    const c = TestBed.createComponent(TableroKdsComponent).componentInstance;
    expect(c.accionPendientes).toBeNull();
  });
});
