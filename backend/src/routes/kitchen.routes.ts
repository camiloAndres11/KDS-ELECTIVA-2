import { Router } from 'express';
import type { OrderService } from '../services/order.service.js';
import { changePriority, changeStatus, getActiveOrders } from '../controllers/kitchen.controller.js';
import { ANY_KDS_ROLE, requireRole } from '../middlewares/auth.middleware.js';

export function kitchenRouter(service: OrderService): Router {
  const router = Router();
  const canOperate = requireRole('KITCHEN_OPERATOR', 'DISPATCHER', 'ADMIN');
  router.get('/kitchen/orders', requireRole(...ANY_KDS_ROLE), getActiveOrders(service));
  router.patch('/kitchen/orders/:id/status', canOperate, changeStatus(service));
  router.patch('/kitchen/orders/:id/priority', canOperate, changePriority(service));
  return router;
}
