import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Guards the /api/v1/admin/* surface consumed by notification-system-ui.
 * A single shared secret (ADMIN_TOKEN) is expected in the `X-Admin-Token`
 * header (or `Authorization: Bearer <token>`). This is intentionally simple:
 * the admin UI is an internal, trusted operator tool.
 */
export const buildAdminAuthHook =
  (adminToken: string) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const header = request.headers['x-admin-token'];
    const bearer = request.headers.authorization;
    const provided =
      (typeof header === 'string' && header) ||
      (typeof bearer === 'string' && bearer.startsWith('Bearer ') ? bearer.slice(7) : '');

    if (!provided) {
      await reply.code(401).send({ error: 'Missing admin token' });
      return;
    }
    if (provided !== adminToken) {
      await reply.code(401).send({ error: 'Invalid admin token' });
      return;
    }
  };
