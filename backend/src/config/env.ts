export const env = {
  TENANT_ID: process.env.TENANT_ID ?? 'dev',
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:4200').split(','),
};
