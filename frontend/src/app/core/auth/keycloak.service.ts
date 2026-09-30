import { Injectable } from '@angular/core';
import Keycloak from 'keycloak-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class KeycloakService {
  private readonly keycloak: Keycloak;

  constructor() {
    this.keycloak = new Keycloak({
      url: environment.auth.keycloak.url,
      realm: environment.auth.keycloak.realm,
      clientId: environment.auth.keycloak.clientId,
    });
  }

  init(): Promise<boolean> {
    return this.keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
    });
  }

  login(): Promise<void> {
    return this.keycloak.login();
  }

  logout(redirectUri: string): Promise<void> {
    return this.keycloak.logout({ redirectUri });
  }

  isAuthenticated(): boolean {
    return this.keycloak.authenticated ?? false;
  }

  token(): string | undefined {
    return this.keycloak.token;
  }

  username(): string {
    const preferido = this.keycloak.tokenParsed?.['preferred_username'];
    return typeof preferido === 'string' ? preferido : 'usuario';
  }

  realmRoles(): string[] {
    return this.keycloak.realmAccess?.roles ?? [];
  }

  clientRoles(): string[] {
    return this.keycloak.resourceAccess?.[environment.auth.keycloak.clientId]?.roles ?? [];
  }
}
