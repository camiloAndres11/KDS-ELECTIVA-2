import { Server } from 'socket.io';
import type http from 'node:http';
import type { Order } from '../domain/order.js';
import type { OrderEventEmitter, PriorityChangedEvent, StatusChangedEvent } from './events.js';

export interface RealtimeServer extends OrderEventEmitter {
  io: Server;
  clientCount(): number;
}

// ponytail: sin autenticación en el handshake todavía (eso es Fase 8). El socket solo difunde; nadie escribe por él.
export function createSocketServer(httpServer: http.Server, corsOrigins: string[]): RealtimeServer {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigins },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  return {
    io,
    clientCount: () => io.engine.clientsCount,
    orderCreated(order: Order) {
      io.emit('order:created', order);
    },
    orderStatusChanged(event: StatusChangedEvent) {
      io.emit('order:status_changed', event);
    },
    orderPriorityChanged(event: PriorityChangedEvent) {
      io.emit('order:priority_changed', event);
    },
  };
}
