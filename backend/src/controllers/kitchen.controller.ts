import type { Request, Response } from 'express';
import type { OrderService } from '../services/order.service.js';
import { changePrioritySchema, changeStatusSchema } from '../schemas/order.schema.js';

export function getActiveOrders(service: OrderService) {
  return async (_req: Request, res: Response) => {
    res.json(await service.getActiveForKds());
  };
}

export function changeStatus(service: OrderService) {
  return async (req: Request, res: Response) => {
    const { status, version } = changeStatusSchema.parse(req.body);
    res.json(await service.changeStatus(String(req.params.id), status, version));
  };
}

export function changePriority(service: OrderService) {
  return async (req: Request, res: Response) => {
    const { priority, version } = changePrioritySchema.parse(req.body);
    res.json(await service.changePriority(String(req.params.id), priority, version));
  };
}
