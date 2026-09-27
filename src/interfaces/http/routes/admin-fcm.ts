import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../composition/container.js';
import type { FcmAudience, FcmPlatform } from '../../../infrastructure/repositories/MySqlFcmRepository.js';

const HistoryQuerySchema = z.object({
  audience: z.enum(['employees', 'dealers']),
  limit: z.coerce.number().min(1).max(200).default(25),
});

const SendSchema = z.object({
  audience: z.enum(['employees', 'dealers']),
  platform: z.enum(['android', 'ios', 'web', 'all']).optional(),
  ids: z.array(z.string().min(1)).optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string()).optional(),
  deepLink: z.string().optional(),
  projectId: z.string().optional(),
});

export const registerAdminFcmRoutes = (
  app: FastifyInstance,
  container: Container,
  guard: { preHandler: preHandlerHookHandler }
): void => {
  const { fcm } = container;

  // Configured Firebase projects (never exposes credentials).
  app.get('/api/v1/admin/fcm/projects', guard, async (_request, reply) => {
    return reply.send({ items: fcm.service.listProjects() });
  });

  // Active device-token counts per audience + device type.
  app.get('/api/v1/admin/fcm/overview', guard, async (_request, reply) => {
    return reply.send(await fcm.repo.overview());
  });

  // Recent push sends for an audience.
  app.get('/api/v1/admin/fcm/history', guard, async (request, reply) => {
    const parsed = HistoryQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(422).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const items = await fcm.repo.history({ audience: parsed.data.audience, limit: parsed.data.limit });
    return reply.send({ items });
  });

  // Admin-composed push to an audience (optionally scoped to specific ids / platform / project).
  app.post('/api/v1/admin/fcm/send', guard, async (request, reply) => {
    const parsed = SendSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const body = parsed.data;
    const audience: FcmAudience = body.audience;
    const platform: FcmPlatform | undefined =
      body.platform && body.platform !== 'all' ? body.platform : undefined;

    const tokens = await fcm.repo.getTokens({ audience, platform, ids: body.ids });
    if (tokens.length === 0) {
      return reply.send({ requested: 0, sent: 0, failed: 0, perProject: [] });
    }

    try {
      const result = await fcm.service.sendToTokens(
        tokens,
        { title: body.title, body: body.body, data: body.data, deepLink: body.deepLink },
        { projectId: body.projectId }
      );
      await fcm.repo.logSend({
        audience,
        notificationType: 'admin_push',
        title: body.title,
        body: body.body,
        data: body.data ?? {},
        recipients: body.ids ?? [],
        successCount: result.sent,
        failureCount: result.failed,
        responseDetails: result.perProject,
        sentBy: 'notification-admin',
      });
      return reply.send({ requested: tokens.length, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(502).send({ error: message });
    }
  });
};
