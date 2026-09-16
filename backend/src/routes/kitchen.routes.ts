import { Router } from 'express';
import type { OrderService } from '../services/order.service.js';
import { changePriority, changeStatus, getActiveOrders } from '../controllers/kitchen.controller.js';

export function kitchenRouter(service: OrderService): Router {
  const router = Router();
  router.get('/kitchen/orders', getActiveOrders(service));
  router.patch('/kitchen/orders/:id/status', changeStatus(service));
  router.patch('/kitchen/orders/:id/priority', changePriority(service));
  return router;
}
