import type { AppEnvironment } from './environment.interface';

export const environment: AppEnvironment = {
  production: true,
  tenant: 'starpizza',
  displayName: 'StarPizza',
  apiUrl: 'https://fy4meajzqd.execute-api.us-east-1.amazonaws.com',
  warningMinutes: 15,
  criticalMinutes: 25,
  realtimeEnabled: false,
  pollingMs: 10000,
  theme: {
    primaryColor: '#FFC72C',
    secondaryColor: '#000000',
    background: '#1a1a2e',
  },
  auth: {
    provider: 'keycloak',
    keycloak: {
      url: 'https://d34c6bytkv46ib.cloudfront.net',
      realm: 'kds-starpizza',
      clientId: 'kds-frontend',
    },
    roles: ['KITCHEN_OPERATOR', 'DISPATCHER', 'POS_SYSTEM', 'ADMIN'],
  },
};
