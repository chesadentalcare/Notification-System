import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../composition/container.js';
import { DomainError } from '../../../domain/errors/DomainErrors.js';
import { CHANNEL_TYPES } from '../../../domain/value-objects/ChannelType.js';
import { NOTIFICATION_STATUSES } from '../../../domain/value-objects/NotificationStatus.js';
import { buildAdminAuthHook } from '../middleware/adminAuth.js';

const RecipientSchema = z.union([
  z.object({ email: z.string().email(), name: z.string().optional() }),
  z.object({ tokens: z.array(z.string().min(10)).min(1).max(500) }),
  z.object({ phone: z.string().min(10) }),
]);

const AdminSendSchema = z.object({
  clientId: z.string().min(1),
  channel: z.enum(['email', 'fcm', 'whatsapp']),
  to: RecipientSchema,
  templateKey: z.string().min(1).max(120),
  data: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

const TemplateSchema = z.object({
  templateKey: z.string().min(1).max(120),
  channel: z.enum(['email', 'fcm', 'whatsapp']),
  subject: z.string().max(500).default(''),
  body: z.string().min(1),
  active: z.boolean().optional(),
});

const ClientSchema = z.object({ name: z.string().min(1).max(120) });
const ClientPatchSchema = z.object({ active: z.boolean() });

const ListQuerySchema = z.object({
  status: z.string().optional(),
  channel: z.string().optional(),
  clientId: z.string().optional(),
  templateKey: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(25),
  offset: z.coerce.number().min(0).default(0),
});

export const registerAdminRoutes = (app: FastifyInstance, container: Container): void => {
  const admin = buildAdminAuthHook(container.env.ADMIN_TOKEN);
  const guard = { preHandler: admin };

  // Session probe — the UI calls this to validate the stored admin token on login.
  app.get('/api/v1/admin/me', guard, async () => ({
    ok: true,
    service: 'notification-gateway',
    dryRun: container.env.NOTIFY_DRY_RUN,
  }));

  // Dashboard metadata + counters.
  app.get('/api/v1/admin/stats', guard, async () => {
    const [stats, templates, clients] = await Promise.all([
      container.notifications.stats(),
      container.templates.listAll(),
      container.apiClients.list(),
    ]);
    return {
      ...stats,
      templates: { total: templates.length, active: templates.filter((t) => t.active).length },
      clients: { total: clients.length, active: clients.filter((c) => c.active).length },
      channels: container.channels.registeredTypes(),
      dryRun: container.env.NOTIFY_DRY_RUN,
    };
  });

  // Channels + their configuration readiness.
  app.get('/api/v1/admin/channels', guard, async () => {
    const env = container.env;
    const registered = container.channels.registeredTypes();
    const readiness: Record<string, boolean> = {
      email: !!env.SMTP_HOST && !!env.SMTP_FROM,
      fcm: !!env.FCM_PROJECT_ID && !!env.FCM_CLIENT_EMAIL && !!env.FCM_PRIVATE_KEY,
      whatsapp: false,
    };
    return {
      dryRun: env.NOTIFY_DRY_RUN,
      channels: CHANNEL_TYPES.map((type) => ({
        type,
        registered: registered.includes(type),
        configured: readiness[type] ?? false,
      })),
    };
  });

  // ---- Notifications ----

  app.get('/api/v1/admin/notifications', guard, async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() });
    }
    const result = await container.notifications.list(parsed.data);
    return reply.send(result);
  });

  app.get('/api/v1/admin/notifications/:id', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const n = await container.notifications.findById(id);
    if (!n) return reply.code(404).send({ error: 'Notification not found' });
    const attemptHistory = await container.notifications.listAttempts(id);
    return reply.send({ ...n.props, attemptHistory });
  });

  // Admin-initiated send (test / manual dispatch from the UI composer).
  app.post('/api/v1/admin/notifications', guard, async (request, reply) => {
    const parsed = AdminSendSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const body = parsed.data;
    try {
      const result = await container.sendNotification.execute({
        clientId: body.clientId,
        channel: body.channel,
        recipient: body.to,
        templateKey: body.templateKey,
        data: body.data,
        idempotencyKey: body.idempotencyKey ?? null,
      });
      return reply.code(result.deduplicated ? 200 : 202).send(result);
    } catch (err) {
      if (err instanceof DomainError) return reply.code(422).send({ error: err.message });
      throw err;
    }
  });

  // ---- Templates ----

  app.get('/api/v1/admin/templates', guard, async () => container.templates.listAll());

  app.get('/api/v1/admin/templates/:id', guard, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const tpl = await container.templates.getById(id);
    if (!tpl) return reply.code(404).send({ error: 'Template not found' });
    return reply.send(tpl);
  });

  app.post('/api/v1/admin/templates', guard, async (request, reply) => {
    const parsed = TemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    try {
      const created = await container.templates.create(parsed.data);
      return reply.code(201).send(created);
    } catch (err) {
      // Unique (template_key, channel) collision.
      if (err && typeof err === 'object' && (err as { code?: string }).code === 'ER_DUP_ENTRY') {
        return reply.code(409).send({ error: 'A template with this key + channel already exists' });
      }
      throw err;
    }
  });

  app.put('/api/v1/admin/templates/:id', guard, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const parsed = TemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const updated = await container.templates.update(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: 'Template not found' });
    return reply.send(updated);
  });

  app.delete('/api/v1/admin/templates/:id', guard, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const ok = await container.templates.remove(id);
    if (!ok) return reply.code(404).send({ error: 'Template not found' });
    return reply.code(204).send();
  });

  // ---- API clients ----

  app.get('/api/v1/admin/clients', guard, async () => container.apiClients.list());

  app.post('/api/v1/admin/clients', guard, async (request, reply) => {
    const parsed = ClientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const created = await container.apiClients.create(parsed.data.name);
    return reply.code(201).send(created);
  });

  app.patch('/api/v1/admin/clients/:id', guard, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const parsed = ClientPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const ok = await container.apiClients.setActive(id, parsed.data.active);
    if (!ok) return reply.code(404).send({ error: 'Client not found' });
    return reply.send({ id: String(id), active: parsed.data.active });
  });

  // Static enums the UI uses to build dropdowns.
  app.get('/api/v1/admin/meta', guard, async () => ({
    channels: CHANNEL_TYPES,
    statuses: NOTIFICATION_STATUSES,
  }));
};
