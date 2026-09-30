import { Injectable, computed, signal } from '@angular/core';
import { KeycloakService } from './keycloak.service';
import { environment } from '../../../environments/environment';
import type { UserRole } from '../../interfaces/user.interface';

export interface SesionUsuario {
  username: string;
  roles: UserRole[];
}

const MOCK_SESSION_KEY = 'kds-mock-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _authenticated = signal(false);
  readonly authenticated = this._authenticated.asReadonly();

  private readonly _usuario = signal<SesionUsuario | null>(null);
  readonly usuario = this._usuario.asReadonly();

  readonly roles = computed(() => this._usuario()?.roles ?? []);

  constructor(private keycloak: KeycloakService) {}

  async init(): Promise<void> {
    if (environment.auth.provider === 'mock') {
      this.recuperarSesionMock();
      return;
    }
    try {
      const autenticado = await this.keycloak.init();
      if (autenticado) {
        this.establecerSesion();
      }
    } catch {
      this._authenticated.set(false);
    }
  }

  login(): Promise<void> {
    if (environment.auth.provider === 'mock') {
      this.establecerSesionMock('admin');
      return Promise.resolve();
    }
    return this.keycloak.login();
  }

  loginMock(username: string, password: string): boolean {
    const usuarioMock = (environment.auth.mockUsers ?? []).find(
      (u) => u.username === username && u.password === password,
    );
    if (!usuarioMock) {
      return false;
    }
    this.establecerSesionMock(usuarioMock.username);
    return true;
  }

  logout(): void {
    if (environment.auth.provider === 'keycloak') {
      void this.keycloak.logout(`${window.location.origin}/auth/login`);
      return;
    }
    localStorage.removeItem(MOCK_SESSION_KEY);
    this._authenticated.set(false);
    this._usuario.set(null);
  }

  token(): string | null {
    if (environment.auth.provider === 'mock') {
      const usuario = this._usuario();
      return usuario ? this.fakeJwt(usuario) : null;
    }
    return this.keycloak.token() ?? null;
  }

  isAuthenticated(): boolean {
    return this._authenticated();
  }

  hasRole(rol: UserRole): boolean {
    return this.roles().includes(rol);
  }

  private establecerSesion(): void {
    const roles = [...this.keycloak.realmRoles(), ...this.keycloak.clientRoles()].filter((rol): rol is UserRole =>
      (environment.auth.roles as string[]).includes(rol),
    );
    this._usuario.set({ username: this.keycloak.username(), roles });
    this._authenticated.set(true);
  }

  private establecerSesionMock(username: string): void {
    const usuarioMock = (environment.auth.mockUsers ?? []).find((u) => u.username === username);
    this._usuario.set({ username, roles: usuarioMock?.roles ?? [] });
    this._authenticated.set(true);
    localStorage.setItem(MOCK_SESSION_KEY, username);
  }

  private recuperarSesionMock(): void {
    const username = localStorage.getItem(MOCK_SESSION_KEY);
    if (username) {
      this.establecerSesionMock(username);
    }
  }

  private fakeJwt(usuario: SesionUsuario): string {
    return btoa(JSON.stringify({ sub: usuario.username, roles: usuario.roles, provider: 'mock' }));
  }
}
