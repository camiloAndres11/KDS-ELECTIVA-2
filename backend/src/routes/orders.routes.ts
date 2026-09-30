import { Router } from 'express';
import type { OrderService } from '../services/order.service.js';
import { createOrder } from '../controllers/orders.controller.js';
import { requireRole } from '../middlewares/auth.middleware.js';

export function ordersRouter(service: OrderService): Router {
  const router = Router();
  router.post('/orders', requireRole('POS_SYSTEM', 'ADMIN'), createOrder(service));
  return router;
}
