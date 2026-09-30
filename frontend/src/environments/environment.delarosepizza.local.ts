import type { AppEnvironment } from './environment.interface';

export const environment: AppEnvironment = {
  production: false,
  tenant: 'delarosepizza',
  displayName: 'Delarose Pizza',
  apiUrl: 'http://localhost:3002',
  warningMinutes: 15,
  criticalMinutes: 25,
  realtimeEnabled: true,
  pollingMs: 10000,
  theme: {
    primaryColor: '#E91E63',
    secondaryColor: '#FFFFFF',
    background: '#1a1a2e',
  },
  auth: {
    provider: 'mock',
    keycloak: {
      url: 'http://localhost:8080',
      realm: 'kds-delarosepizza',
      clientId: 'kds-frontend',
    },
    roles: ['KITCHEN_OPERATOR', 'DISPATCHER', 'POS_SYSTEM', 'ADMIN'],
    mockUsers: [
      { username: 'admin', password: 'uptc2025', roles: ['ADMIN'] },
      { username: 'cocinero', password: 'uptc2025', roles: ['KITCHEN_OPERATOR'] },
    ],
  },
};
