import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../composition/container.js';

const EstimateBody = z.object({
  channel: z.enum(['email', 'whatsapp']),
  company: z.string().optional(),
  department: z.string().optional(),
});

const CampaignBody = z.object({
  name: z.string().min(1).max(200),
  channel: z.enum(['email', 'whatsapp']),
  templateKey: z.string().min(1).max(120),
  company: z.string().optional(),
  department: z.string().optional(),
  limit: z.coerce.number().min(1).max(50000).optional(),
  testContact: z.string().min(3).max(255).optional(),
  whatsappTemplate: z.unknown().optional(),
});

export const registerAdminStaffRoutes = (
  app: FastifyInstance,
  container: Container,
  guard: { preHandler: preHandlerHookHandler }
): void => {
  app.get('/api/v1/admin/staff/campaigns', guard, async (request, reply) => {
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const items = await container.staff.listCampaigns(Number(limit) || 50, Number(offset) || 0);
    return reply.send({ items });
  });

  app.get('/api/v1/admin/staff/campaigns/:id', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await container.staff.getCampaign(id);
    if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });
    const recipients = await container.staff.listRecipients(id, 200, 0);
    return reply.send({ ...campaign, recipients });
  });

  // Reachable audience size for the chosen channel + filter (UI preview).
  app.post('/api/v1/admin/staff/estimate', guard, async (request, reply) => {
    const parsed = EstimateBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const count = await container.staffService.estimate(parsed.data.channel, {
      company: parsed.data.company,
      department: parsed.data.department,
    });
    return reply.send({ count });
  });

  // Create a campaign and enqueue its sends.
  app.post('/api/v1/admin/staff/campaigns', guard, async (request, reply) => {
    const parsed = CampaignBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const result = await container.staffService.createAndSend({
      name: parsed.data.name,
      channel: parsed.data.channel,
      templateKey: parsed.data.templateKey,
      company: parsed.data.company,
      department: parsed.data.department,
      limit: parsed.data.limit,
      testContact: parsed.data.testContact,
      whatsappTemplate: parsed.data.whatsappTemplate,
    });
    return reply.code(result.enqueued > 0 ? 202 : 200).send(result);
  });
};
