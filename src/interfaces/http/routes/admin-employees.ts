import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../composition/container.js';
import type { StaffChannel } from '../../../infrastructure/repositories/MySqlEmployeeRepository.js';

const ListQuery = z.object({
  q: z.string().optional(),
  company: z.string().optional(),
  department: z.string().optional(),
  channel: z.enum(['email', 'whatsapp']).optional(),
  activeOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(200).default(25),
  offset: z.coerce.number().min(0).default(0),
});

const OptOutBody = z.object({ optedOut: z.boolean() });

const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const registerAdminEmployeeRoutes = (
  app: FastifyInstance,
  container: Container,
  guard: { preHandler: preHandlerHookHandler }
): void => {
  // Staff "contact base" synced from SAP → production_dashboard.employees.
  app.get('/api/v1/admin/employees', guard, async (request, reply) => {
    const parsed = ListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() });
    }
    const result = await container.employees.list({
      q: parsed.data.q,
      company: parsed.data.company,
      department: parsed.data.department,
      channel: parsed.data.channel as StaffChannel | undefined,
      activeOnly: parsed.data.activeOnly,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return reply.send(result);
  });

  // Segment counts for the Staff Base header + campaign audience preview.
  app.get('/api/v1/admin/employees/segments', guard, async (_request, reply) => {
    return reply.send(await container.employees.segments());
  });

  // CSV export of the current filter (bounded).
  app.get('/api/v1/admin/employees/export', guard, async (request, reply) => {
    const parsed = ListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() });
    }
    const { items } = await container.employees.list({
      q: parsed.data.q,
      company: parsed.data.company,
      department: parsed.data.department,
      channel: parsed.data.channel as StaffChannel | undefined,
      activeOnly: parsed.data.activeOnly,
      limit: 5000,
      offset: 0,
    });
    const header = 'company,gl_code,hr_code,name,phone,email,department,position,active,opted_out';
    const lines = items.map((e) =>
      [e.company, e.glCode, e.hrCode, e.name, e.phone, e.email, e.department, e.position, e.active ? 1 : 0, e.optedOut ? 1 : 0]
        .map(csvCell)
        .join(',')
    );
    const csv = [header, ...lines].join('\r\n');
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="employees.csv"')
      .send(csv);
  });

  // Opt an employee out of (or back into) staff messages. id = `${company}:${glCode}`.
  app.patch('/api/v1/admin/employees/:id/opt-out', guard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const sep = id.indexOf(':');
    if (sep < 0) return reply.code(400).send({ error: 'id must be company:glCode' });
    const company = id.slice(0, sep);
    const glCode = id.slice(sep + 1);
    const parsed = OptOutBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const ok = await container.employees.setOptOut(company, glCode, parsed.data.optedOut);
    if (!ok) return reply.code(404).send({ error: 'Employee not found' });
    return reply.send({ id, optedOut: parsed.data.optedOut });
  });
};
