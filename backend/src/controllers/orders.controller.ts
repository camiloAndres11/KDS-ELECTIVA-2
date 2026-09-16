import type { Request, Response } from 'express';
import type { OrderService } from '../services/order.service.js';
import { createOrderSchema } from '../schemas/order.schema.js';

export function createOrder(service: OrderService) {
  return async (req: Request, res: Response) => {
    const input = createOrderSchema.parse(req.body);
    const order = await service.create(input);
    res.status(201).json(order);
  };
}
