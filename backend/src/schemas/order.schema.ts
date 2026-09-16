import { z } from 'zod';

export const createOrderSchema = z.object({
  displayCode: z.string().min(1).max(10),
  channel: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']),
  priority: z.enum(['NORMAL', 'HIGH', 'VIP']).default('NORMAL'),
  customerName: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        productName: z.string().min(1).max(150),
        quantity: z.number().int().positive(),
        notes: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

export const changeStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PREPARATION', 'READY', 'DISPATCHED', 'CANCELLED']),
  version: z.number().int().positive(),
});

export const changePrioritySchema = z.object({
  priority: z.enum(['NORMAL', 'HIGH', 'VIP']),
  version: z.number().int().positive(),
});
