import { Server } from 'socket.io';
import type http from 'node:http';
import type { Order } from '../domain/order.js';
import type { OrderEventEmitter, PriorityChangedEvent, StatusChangedEvent } from './events.js';
import { ANY_KDS_ROLE, assertRole, type TokenVerifier } from '../middlewares/auth.middleware.js';

export interface RealtimeServer extends OrderEventEmitter {
  io: Server;
  clientCount(): number;
}

// ponytail: el token se valida solo en el handshake; un socket ya conectado sigue recibiendo eventos aunque el token venza. Nadie escribe por él.
export function createSocketServer(httpServer: http.Server, corsOrigins: string[], verify?: TokenVerifier): RealtimeServer {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigins },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  if (verify) {
    io.use(async (socket, next) => {
      try {
        assertRole(await verify(String(socket.handshake.auth.token ?? '')), ANY_KDS_ROLE);
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

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
