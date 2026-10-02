import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../composition/container.js';
import type { CareChannel } from '../../../infrastructure/repositories/MySqlCustomerRepository.js';

const ListQuery = z.object({
  q: z.string().optional(),
  company: z.string().optional(),
  channel: z.enum(['email', 'whatsapp']).optional(),
  withinYears: z.coerce.number().min(1).max(50).optional(),
  limit: z.coerce.number().min(1).max(200).default(25),
  offset: z.coerce.number().min(0).default(0),
});

const OptOutBody = z.object({ optedOut: z.boolean() });

const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const registerAdminCustomerRoutes = (
  app: FastifyInstance,
  container: Container,
  guard: { preHandler: preHandlerHookHandler }
): void => {
  // Buyer "care base" synced from SAP → production_dashboard.care_customers.
  app.get('/api/v1/admin/customers', guard, async (request, reply) => {
    const parsed = ListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() });
    }
    const result = await container.customers.list({
      q: parsed.data.q,
      company: parsed.data.company,
      channel: parsed.data.channel as CareChannel | undefined,
      withinYears: parsed.data.withinYears,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return reply.send(result);
  });

  // Segment counts for the Customer Base header + campaign audience preview.
  app.get('/api/v1/admin/customers/segments', guard, async (_request, reply) => {
    return reply.send(await container.customers.segments());
  });

  // CSV export of the current filter (bounded).
  app.get('/api/v1/admin/customers/export', guard, async (request, reply) => {
    const parsed = ListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() });
    }
    const { items } = await container.customers.list({
      q: parsed.data.q,
      company: parsed.data.company,
      channel: parsed.data.channel as CareChannel | undefined,
      withinYears: parsed.data.withinYears,
      limit: 5000,
      offset: 0,
    });
    const header = 'company,card_code,name,phone,email,last_purchase_date,purchase_count,opted_out';
    const lines = items.map((c) =>
      [c.company, c.cardCode, c.name, c.phone, c.email, c.lastPurchaseDate, c.purchaseCount, c.optedOut ? 1 : 0]
        .map(csvCell)
        .join(',')
    );
    const csv = [header, ...lines].join('\r\n');
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="care-customers.csv"')
      .send(csv);
  });

  // Opt a customer out of (or back into) care messages. id = `${company}:${cardCode}`.
  app.patch('/api/v1/admin/customers/:id/opt-out', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const sep = id.indexOf(':');
    if (sep < 0) return reply.code(400).send({ error: 'id must be company:cardCode' });
    const company = id.slice(0, sep);
    const cardCode = id.slice(sep + 1);
    const parsed = OptOutBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const ok = await container.customers.setOptOut(company, cardCode, parsed.data.optedOut);
    if (!ok) return reply.code(404).send({ error: 'Customer not found' });
    return reply.send({ id, optedOut: parsed.data.optedOut });
  });
};
