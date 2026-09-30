import type { AppEnvironment } from './environment.interface';

export const environment: AppEnvironment = {
  production: true,
  tenant: 'delarosepizza',
  displayName: 'Delarose Pizza',
  apiUrl: 'https://api.delarosepizza.kds.example.com',
  warningMinutes: 15,
  criticalMinutes: 25,
  realtimeEnabled: false,
  pollingMs: 10000,
  theme: {
    primaryColor: '#E91E63',
    secondaryColor: '#FFFFFF',
    background: '#1a1a2e',
  },
  auth: {
    provider: 'keycloak',
    keycloak: {
      url: 'https://auth.delarosepizza.kds.example.com',
      realm: 'kds-delarosepizza',
      clientId: 'kds-frontend',
    },
    roles: ['KITCHEN_OPERATOR', 'DISPATCHER', 'POS_SYSTEM', 'ADMIN'],
  },
};
