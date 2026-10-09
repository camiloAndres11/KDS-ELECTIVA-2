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
    provider: 'keycloak',
    keycloak: {
      url: 'http://localhost:8081',
      realm: 'kds-delarosepizza',
      clientId: 'kds-frontend',
    },
    roles: ['KITCHEN_OPERATOR', 'DISPATCHER', 'POS_SYSTEM', 'ADMIN'],
  },
};
