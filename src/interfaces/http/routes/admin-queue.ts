import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { Container } from '../../../composition/container.js';

export const registerAdminQueueRoutes = (
  app: FastifyInstance,
  container: Container,
  guard: { preHandler: preHandlerHookHandler }
): void => {
  // BullMQ queue + worker health for the admin "Queue / Worker" monitor.
  app.get('/api/v1/admin/queue', guard, async (_request, reply) => {
    return reply.send(await container.queue.getStats());
  });
};
