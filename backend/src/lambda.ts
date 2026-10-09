import serverless from 'serverless-http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { verifierFromEnv } from './middlewares/auth.middleware.js';
import { NOOP_EMITTER } from './realtime/events.js';
import { PrismaOrderRepository } from './repositories/prisma-order.repository.js';
import { OrderService } from './services/order.service.js';

const repository = new PrismaOrderRepository(prisma);
const service = new OrderService(repository, NOOP_EMITTER);

const app = createApp(service, {
  tenantId: env.TENANT_ID,
  corsOrigins: env.CORS_ORIGINS,
  auth: verifierFromEnv(),
});

export const handler = serverless(app);
