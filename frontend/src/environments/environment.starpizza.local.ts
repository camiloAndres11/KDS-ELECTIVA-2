import type { AppEnvironment } from './environment.interface';

export const environment: AppEnvironment = {
  production: false,
  tenant: 'starpizza',
  displayName: 'StarPizza',
  apiUrl: 'http://localhost:3001',
  warningMinutes: 15,
  criticalMinutes: 25,
  realtimeEnabled: true,
  pollingMs: 10000,
  theme: {
    primaryColor: '#FFC72C',
    secondaryColor: '#000000',
    background: '#1a1a2e',
  },
  auth: {
    provider: 'mock',
    keycloak: {
      url: 'http://localhost:8080',
      realm: 'kds-starpizza',
      clientId: 'kds-frontend',
    },
    roles: ['KITCHEN_OPERATOR', 'DISPATCHER', 'POS_SYSTEM', 'ADMIN'],
    mockUsers: [
      { username: 'admin', password: 'uptc2025', roles: ['ADMIN'] },
      { username: 'cocinero', password: 'uptc2025', roles: ['KITCHEN_OPERATOR'] },
    ],
  },
};
