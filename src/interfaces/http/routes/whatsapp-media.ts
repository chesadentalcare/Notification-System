import type { FastifyInstance } from 'fastify';
import type { Container } from '../../../composition/container.js';
import { MediaFetchError } from '../../../infrastructure/whatsapp/WhatsAppService.js';

// PUBLIC WhatsApp media proxy (no X-Admin-Token) so <img src> / <video src> in the
// admin UI can load attachments directly. Mirrors chesa_api_gateway's getWhatsAppMedia:
// resolve the Meta media id → CDN url with the WABA token, stream the bytes back with
// the resolved mime and a private, day-long cache. The token stays server-side.
export const registerWhatsAppMediaRoute = (app: FastifyInstance, container: Container): void => {
  app.get('/api/v1/whatsapp/media/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
      return reply.code(400).send({ error: 'Invalid media id' });
    }
    try {
      const { buffer, mime } = await container.whatsapp.service.fetchMedia(id);
      reply.header('Content-Type', mime);
      reply.header('Cache-Control', 'private, max-age=86400');
      return reply.send(buffer);
    } catch (err) {
      const status = err instanceof MediaFetchError ? err.status : 502;
      return reply.code(status).send({ error: 'Failed to fetch media' });
    }
  });
};
