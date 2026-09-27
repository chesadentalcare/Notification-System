import { loadEnv, type Env } from '../config/env.js';
import { GetNotificationStatusUseCase } from '../application/GetNotificationStatusUseCase.js';
import { ProcessNotificationUseCase } from '../application/ProcessNotificationUseCase.js';
import { SendNotificationUseCase } from '../application/SendNotificationUseCase.js';
import { ChannelRegistry } from '../infrastructure/channels/ChannelRegistry.js';
import { EmailChannel } from '../infrastructure/channels/EmailChannel.js';
import { FcmChannel } from '../infrastructure/channels/FcmChannel.js';
import { WhatsAppChannel } from '../infrastructure/channels/WhatsAppChannel.js';
import { createPool, type DbPool } from '../infrastructure/db/pool.js';
import { BullMqQueueAdapter } from '../infrastructure/queue/BullMqQueueAdapter.js';
import { MySqlApiClientRepository } from '../infrastructure/repositories/MySqlApiClientRepository.js';
import { MySqlNotificationRepository } from '../infrastructure/repositories/MySqlNotificationRepository.js';
import { MySqlTemplateRepository } from '../infrastructure/repositories/MySqlTemplateRepository.js';
import { MySqlWhatsAppRepository } from '../infrastructure/repositories/MySqlWhatsAppRepository.js';
import { MySqlFcmRepository } from '../infrastructure/repositories/MySqlFcmRepository.js';
import { HandlebarsRenderer } from '../infrastructure/templates/HandlebarsRenderer.js';
import { WhatsAppService } from '../infrastructure/whatsapp/WhatsAppService.js';
import { FcmProjectsService } from '../infrastructure/fcm/FcmProjectsService.js';
import { logger } from '../infrastructure/logger.js';

export interface Container {
  env: Env;
  pool: DbPool;
  queue: BullMqQueueAdapter;
  channels: ChannelRegistry;
  apiClients: MySqlApiClientRepository;
  notifications: MySqlNotificationRepository;
  templates: MySqlTemplateRepository;
  whatsapp: {
    repo: MySqlWhatsAppRepository;
    service: WhatsAppService;
  };
  fcm: {
    service: FcmProjectsService;
    repo: MySqlFcmRepository;
  };
  sendNotification: SendNotificationUseCase;
  getNotificationStatus: GetNotificationStatusUseCase;
  processNotification: ProcessNotificationUseCase;
}

export const buildContainer = (): Container => {
  const env = loadEnv();
  const pool = createPool(env);
  const notifications = new MySqlNotificationRepository(pool);
  const templates = new MySqlTemplateRepository(pool);
  const apiClients = new MySqlApiClientRepository(pool);
  const queue = new BullMqQueueAdapter(env);
  const renderer = new HandlebarsRenderer(templates);

  let whatsappService: WhatsAppService;
  const whatsappRepo = new MySqlWhatsAppRepository(pool, env.WHATSAPP_INBOUND_DB, env.WHATSAPP_OUTBOUND_DB, () =>
    whatsappService.getTemplateBodies()
  );
  whatsappService = new WhatsAppService(env, whatsappRepo, logger);

  const fcmService = new FcmProjectsService(env, logger);
  const fcmRepo = new MySqlFcmRepository(pool, env.FCM_EMPLOYEE_DB, env.FCM_DEALER_DB);

  const channels = new ChannelRegistry()
    .register(new EmailChannel(env))
    .register(new FcmChannel(env))
    .register(new WhatsAppChannel(whatsappService));

  return {
    env,
    pool,
    queue,
    channels,
    apiClients,
    notifications,
    templates,
    whatsapp: { repo: whatsappRepo, service: whatsappService },
    fcm: { service: fcmService, repo: fcmRepo },
    sendNotification: new SendNotificationUseCase(notifications, queue),
    getNotificationStatus: new GetNotificationStatusUseCase(notifications),
    processNotification: new ProcessNotificationUseCase(notifications, renderer, channels),
  };
};
