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
  // Multi-project push: JSON array string of { projectId, clientEmail, privateKey, label }.
  // Parsed lazily (not by zod) so a malformed string doesn't crash startup validation.
  FCM_PROJECTS: z.string().default(''),
  // Databases holding the device-token tables + push logs for each audience.
  FCM_EMPLOYEE_DB: z.string().default('production_dashboard'),
  FCM_DEALER_DB: z.string().default('dealer_mobile_app'),
  // WhatsApp (Meta Graph API / WABA) — same account chesa_api_gateway uses.
  WHATSAPP_API_BASE: z.string().default('https://graph.facebook.com'),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default('500138309848954'),
  WHATSAPP_WABA_ID: z.string().default('533013446553813'),
  WHATSAPP_ACCESS_TOKEN: z.string().default(''),
  WHATSAPP_DEFAULT_COUNTRY_CODE: z.string().default('91'),
  // Existing shared WhatsApp log (read-only): inbound messages are persisted by the
  // telecaller service, outbound by chesa_api_gateway. This service reads both to show
  // all conversations, and appends its own sends to the outbound DB.
  WHATSAPP_INBOUND_DB: z.string().default('telecaller_crm_staging'),
  WHATSAPP_OUTBOUND_DB: z.string().default('production_dashboard'),
  NOTIFY_DRY_RUN: z
    .string()
    .default('0')
    .transform((v) => v === 'true' || v === '1'),
  // Admin API — protects the /api/v1/admin/* surface consumed by the admin UI.
  ADMIN_TOKEN: z.string().default('dev-admin-token'),
  // Comma-separated list of allowed browser origins for the admin UI. '*' allows any.
  CORS_ORIGIN: z.string().default('*'),
  // Care campaigns — the chair-buyer base (care_customers) synced from SAP by
  // chesa_api_gateway lives in this DB; read cross-DB on the same connection, so
  // DB_HOST must reach it (the shared RDS) in production.
  CUSTOMERS_DB: z.string().default('production_dashboard'),
  // Base complaint/service-call site; care messages deep-link here (prefilled ?phone=).
  COMPLAINT_URL: z.string().default('https://servicecalls.ashvahealthtech.com/'),
  // Synthetic client id recorded against care-campaign notifications.
  CARE_CLIENT_ID: z.string().default('care'),
  // Safety cap on how many recipients a single campaign may enqueue.
  CARE_MAX_RECIPIENTS: z.coerce.number().default(5000),
  // Staff campaigns — the employee contact base (employees) synced from SAP by
  // chesa_api_gateway (salary GL codes 36xxx + EmployeesInfo) lives in this DB;
  // read cross-DB on the same connection, same as CUSTOMERS_DB.
  EMPLOYEES_DB: z.string().default('production_dashboard'),
  // Optional staff portal/superapp base; staff messages deep-link here when set.
  STAFF_PORTAL_URL: z.string().default(''),
  // Synthetic client id recorded against staff-campaign notifications.
  STAFF_CLIENT_ID: z.string().default('staff'),
  // Safety cap on how many recipients a single staff campaign may enqueue.
  STAFF_MAX_RECIPIENTS: z.coerce.number().default(5000),
});

export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (): Env => {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
};
