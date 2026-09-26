import Fastify from 'fastify';
import cors from '@fastify/cors';
import { buildContainer } from './composition/container.js';
import { registerHealthRoutes } from './interfaces/http/routes/health.js';
import { registerNotificationRoutes } from './interfaces/http/routes/notifications.js';
import { registerAdminRoutes } from './interfaces/http/routes/admin.js';
import { logger } from './infrastructure/logger.js';

const container = buildContainer();
const app = Fastify({ logger: false });

const corsOrigin = container.env.CORS_ORIGIN.trim();
app.register(cors, {
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Admin-Token', 'Authorization'],
});

registerHealthRoutes(app, container);
registerNotificationRoutes(app, container);
registerAdminRoutes(app, container);

app.setErrorHandler((error, _request, reply) => {
  logger.error({ err: error }, 'Unhandled API error');
  reply.code(500).send({ error: 'Internal server error' });
});

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: container.env.PORT, host: '0.0.0.0' });
    logger.info({ port: container.env.PORT, channels: container.channels.registeredTypes() }, 'notify-api listening');
  } catch (err) {
    logger.error({ err }, 'Failed to start API');
    process.exit(1);
  }
};

const shutdown = async (): Promise<void> => {
  logger.info('Shutting down notify-api');
  await app.close();
  await container.queue.close();
  await container.pool.end();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
