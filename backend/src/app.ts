import express, { type Express } from 'express';
import cors from 'cors';
import type { OrderService } from './services/order.service.js';
import { ordersRouter } from './routes/orders.routes.js';
import { kitchenRouter } from './routes/kitchen.routes.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

export interface AppOptions {
  tenantId: string;
  corsOrigins: string[];
  getWsClientCount?: () => number;
}

export function createApp(service: OrderService, opts: AppOptions): Express {
  const app = express();
  app.use(cors({ origin: opts.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', tenant: opts.tenantId, wsClients: opts.getWsClientCount?.() ?? 0 });
  });

  app.use('/api/v1', ordersRouter(service));
  app.use('/api/v1', kitchenRouter(service));

  app.use(errorMiddleware);
  return app;
}
