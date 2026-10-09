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
    // El backend valida el JWT: sin refresco el access token (~5 min) dejaría de servir. Si el refresh falla, la sesión SSO murió.
    this.keycloak.onTokenExpired = () => {
      this.keycloak.updateToken(30).catch(() => this.keycloak.login());
    };
  }

  init(): Promise<boolean> {
    return this.keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      // Con Keycloak en otro sitio (AWS) el navegador bloquea las cookies de terceros del iframe de sesión, que responde
      // "changed"; keycloak-js borra entonces el refresh token y el refresco falla en bucle. La sesión la validan el refresh y el backend.
      checkLoginIframe: false,
      // Sin silentCheckSsoRedirectUri el check-sso es una redirección normal (prompt=none): funciona aunque el navegador
      // bloquee las cookies de terceros, que es lo que rompe al iframe silencioso cuando Keycloak está en otro sitio.
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

  /** Refresca el token si le quedan menos de `minSegundos`. Si falla, la sesión SSO murió: vuelve al login. */
  async actualizarToken(minSegundos: number): Promise<void> {
    try {
      await this.keycloak.updateToken(minSegundos);
    } catch {
      await this.keycloak.login();
    }
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
