const PORT = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(PORT)) throw new Error(`PORT inválido: "${process.env.PORT}"`);

export const env = {
  TENANT_ID: process.env.TENANT_ID ?? 'dev',
  PORT,
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // OpenID Connect (Keycloak). Sin AUTH_ISSUER la API queda abierta, como antes.
  AUTH_ISSUER: (process.env.AUTH_ISSUER ?? '').replace(/\/+$/, ''),
  AUTH_AUDIENCE: process.env.AUTH_AUDIENCE ?? '',
  AUTH_CLIENT_ID: process.env.AUTH_CLIENT_ID ?? 'kds-frontend',
};
