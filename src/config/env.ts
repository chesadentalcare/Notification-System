import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4600),
  LOG_LEVEL: z.string().default('info'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('notification_service'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default(''),
  FCM_PROJECT_ID: z.string().default(''),
  FCM_CLIENT_EMAIL: z.string().default(''),
  FCM_PRIVATE_KEY: z.string().default(''),
  // WhatsApp (Meta Graph API / WABA) — same account chesa_api_gateway uses.
  WHATSAPP_API_BASE: z.string().default('https://graph.facebook.com'),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default('500138309848954'),
  WHATSAPP_WABA_ID: z.string().default('533013446553813'),
  WHATSAPP_ACCESS_TOKEN: z.string().default(''),
  WHATSAPP_DEFAULT_COUNTRY_CODE: z.string().default('91'),
  // Existing shared WhatsApp log written by chesa_api_gateway; this service reads
  // it (all conversations) and appends its own sends to whatsapp_outbound.
  WHATSAPP_SOURCE_DB: z.string().default('production_dashboard'),
  NOTIFY_DRY_RUN: z
    .string()
    .default('0')
    .transform((v) => v === 'true' || v === '1'),
  // Admin API — protects the /api/v1/admin/* surface consumed by the admin UI.
  ADMIN_TOKEN: z.string().default('dev-admin-token'),
  // Comma-separated list of allowed browser origins for the admin UI. '*' allows any.
  CORS_ORIGIN: z.string().default('*'),
});

export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (): Env => {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
};
