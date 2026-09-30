import http from 'node:http';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { PrismaOrderRepository } from './repositories/prisma-order.repository.js';
import { OrderService } from './services/order.service.js';
import { createSocketServer } from './realtime/socket.js';
import { createApp } from './app.js';
import { verifierFromEnv } from './middlewares/auth.middleware.js';

const repo = new PrismaOrderRepository(prisma);
const httpServer = http.createServer();

// engine.io (socket.io) captura los listeners de 'request' que ya existan en el
// momento en que se le pasa el httpServer, para delegarles lo que no sea suyo.
// Este puente se registra ANTES de crear el Server de socket.io para quedar
// dentro de esa lista; se reasigna a Express en cuanto `app` queda construido.
// Sin esto, Express se registra como listener independiente y ambos responden
// la misma petición a /socket.io/..., causando ERR_HTTP_HEADERS_SENT.
let requestHandler: http.RequestListener = (_req, res) => {
  res.statusCode = 503;
  res.end();
};
httpServer.on('request', (req, res) => requestHandler(req, res));

const auth = verifierFromEnv();
const realtime = createSocketServer(httpServer, env.CORS_ORIGINS, auth);
const service = new OrderService(repo, realtime);
requestHandler = createApp(service, {
  tenantId: env.TENANT_ID,
  corsOrigins: env.CORS_ORIGINS,
  getWsClientCount: realtime.clientCount,
  auth,
});

httpServer.listen(env.PORT, () => {
  console.log(`[${env.TENANT_ID}] KDS backend escuchando en :${env.PORT}`);
});
