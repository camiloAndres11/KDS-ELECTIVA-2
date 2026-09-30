import type { UserRole } from '../app/interfaces/user.interface';

export type AuthProvider = 'keycloak' | 'mock';

export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

export interface MockUser {
  username: string;
  password: string;
  roles: UserRole[];
}

export interface AppEnvironment {
  production: boolean;
  tenant: string;
  displayName: string;
  apiUrl: string;
  warningMinutes: number;
  criticalMinutes: number;
  realtimeEnabled: boolean;
  pollingMs: number;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    background: string;
  };
  auth: {
    provider: AuthProvider;
    keycloak: KeycloakConfig;
    roles: UserRole[];
    mockUsers?: MockUser[];
  };
}
