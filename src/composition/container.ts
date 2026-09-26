import { loadEnv, type Env } from '../config/env.js';
import { GetNotificationStatusUseCase } from '../application/GetNotificationStatusUseCase.js';
import { ProcessNotificationUseCase } from '../application/ProcessNotificationUseCase.js';
import { SendNotificationUseCase } from '../application/SendNotificationUseCase.js';
import { ChannelRegistry } from '../infrastructure/channels/ChannelRegistry.js';
import { EmailChannel } from '../infrastructure/channels/EmailChannel.js';
import { FcmChannel } from '../infrastructure/channels/FcmChannel.js';
import { createPool, type DbPool } from '../infrastructure/db/pool.js';
import { BullMqQueueAdapter } from '../infrastructure/queue/BullMqQueueAdapter.js';
import { MySqlApiClientRepository } from '../infrastructure/repositories/MySqlApiClientRepository.js';
import { MySqlNotificationRepository } from '../infrastructure/repositories/MySqlNotificationRepository.js';
import { MySqlTemplateRepository } from '../infrastructure/repositories/MySqlTemplateRepository.js';
import { HandlebarsRenderer } from '../infrastructure/templates/HandlebarsRenderer.js';

export interface Container {
  env: Env;
  pool: DbPool;
  queue: BullMqQueueAdapter;
  channels: ChannelRegistry;
  apiClients: MySqlApiClientRepository;
  notifications: MySqlNotificationRepository;
  templates: MySqlTemplateRepository;
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

  const channels = new ChannelRegistry()
    .register(new EmailChannel(env))
    .register(new FcmChannel(env));

  return {
    env,
    pool,
    queue,
    channels,
    apiClients,
    notifications,
    templates,
    sendNotification: new SendNotificationUseCase(notifications, queue),
    getNotificationStatus: new GetNotificationStatusUseCase(notifications),
    processNotification: new ProcessNotificationUseCase(notifications, renderer, channels),
  };
};
