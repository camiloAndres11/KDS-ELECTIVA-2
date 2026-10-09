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
    provider: 'keycloak',
    keycloak: {
      url: 'http://localhost:8081',
      realm: 'kds-starpizza',
      clientId: 'kds-frontend',
    },
    roles: ['KITCHEN_OPERATOR', 'DISPATCHER', 'POS_SYSTEM', 'ADMIN'],
  },
};
