import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../composition/container.js';
import type { WhatsAppTemplateComponent } from '../../../infrastructure/whatsapp/WhatsAppService.js';

const ConversationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
  q: z.string().optional(),
});

const ThreadQuerySchema = z.object({
  phone: z.string().min(1),
  limit: z.coerce.number().min(1).max(500).default(100),
});

const SendSchema = z
  .object({
    phone: z.string().min(1),
    text: z.string().min(1).optional(),
    templateName: z.string().min(1).max(120).optional(),
    templateLanguage: z.string().min(1).max(20).optional(),
    params: z.array(z.string()).optional(),
  })
  .refine((v) => !!v.text || !!v.templateName, {
    message: 'Provide either text or templateName',
  });

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(512),
  category: z.string().min(1),
  language: z.string().min(1).max(20),
  body: z.string().min(1),
  example: z.array(z.string()).optional(),
});

// Positional template variables → a Meta "body" component with text parameters.
const paramsToComponents = (params?: string[]): WhatsAppTemplateComponent[] | undefined => {
  if (!params || params.length === 0) return undefined;
  return [
    {
      type: 'body',
      parameters: params.map((text) => ({ type: 'text', text })),
    },
  ];
};

export const registerAdminWhatsAppRoutes = (
  app: FastifyInstance,
  container: Container,
  guard: { preHandler: preHandlerHookHandler }
): void => {
  const { whatsapp } = container;

  app.get('/api/v1/admin/whatsapp/conversations', guard, async (request, reply) => {
    const parsed = ConversationsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() });
    }
    const items = await whatsapp.repo.listConversations(parsed.data);
    return reply.send({ items });
  });

  app.get('/api/v1/admin/whatsapp/thread', guard, async (request, reply) => {
    const parsed = ThreadQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() });
    }
    const items = await whatsapp.repo.getThread(parsed.data.phone, { limit: parsed.data.limit });
    return reply.send({ phone: parsed.data.phone, items });
  });

  app.post('/api/v1/admin/whatsapp/send', guard, async (request, reply) => {
    const parsed = SendSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const body = parsed.data;
    const result = body.templateName
      ? await whatsapp.service.sendTemplate(
          body.phone,
          body.templateName,
          body.templateLanguage ?? 'en',
          paramsToComponents(body.params),
          { sentBy: 'admin' }
        )
      : await whatsapp.service.sendText(body.phone, body.text as string, { sentBy: 'admin' });

    return reply.send({ waMessageId: result.waMessageId, outboundId: result.outboundId });
  });

  // --- Templates (Meta WABA) — the "WhatsApp templates" + "go-live" surface ---
  app.get('/api/v1/admin/whatsapp/templates', guard, async (_request, reply) => {
    try {
      const items = await whatsapp.service.listTemplates();
      return reply.send({ items });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(502).send({ error: message });
    }
  });

  app.post('/api/v1/admin/whatsapp/templates', guard, async (request, reply) => {
    const parsed = CreateTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    try {
      const result = await whatsapp.service.createTemplate(parsed.data);
      return reply.code(201).send({ result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(502).send({ error: message });
    }
  });

  app.delete('/api/v1/admin/whatsapp/templates', guard, async (request, reply) => {
    const name = (request.query as { name?: string } | undefined)?.name;
    if (!name) return reply.code(400).send({ error: 'name query param is required' });
    try {
      await whatsapp.service.deleteTemplate(name);
      return reply.send({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(502).send({ error: message });
    }
  });
};
