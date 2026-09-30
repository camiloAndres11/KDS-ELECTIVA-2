export const env = {
  TENANT_ID: process.env.TENANT_ID ?? 'dev',
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:4200').split(','),
  // OpenID Connect (Keycloak). Sin AUTH_ISSUER la API queda abierta, como antes.
  AUTH_ISSUER: (process.env.AUTH_ISSUER ?? '').replace(/\/+$/, ''),
  AUTH_AUDIENCE: process.env.AUTH_AUDIENCE ?? '',
  AUTH_CLIENT_ID: process.env.AUTH_CLIENT_ID ?? 'kds-frontend',
};
