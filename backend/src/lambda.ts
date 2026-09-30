import { PrismaClient } from '@prisma/client';
import serverless from 'serverless-http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { NOOP_EMITTER } from './realtime/events.js';
import { PrismaOrderRepository } from './repositories/prisma-order.repository.js';
import { OrderService } from './services/order.service.js';

const prisma = new PrismaClient();
const repository = new PrismaOrderRepository(prisma);
const service = new OrderService(repository, NOOP_EMITTER);

const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:4200')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = createApp(service, {
  tenantId: env.TENANT_ID,
  corsOrigins,
});

export const handler = serverless(app);
