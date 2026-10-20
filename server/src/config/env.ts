import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v === 'true'));

const int = (def: number, min = 0) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : Number(v)))
    .pipe(z.number().int().min(min));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(4000, 1),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  ADDITIONAL_CORS_ORIGINS: z.string().optional().default(''),

  MONGODB_URI: z.string().min(1),
  REQUIRE_REPLICA_SET: bool(true),

  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MINUTES: int(15, 1),
  REFRESH_TOKEN_TTL_DAYS: int(7, 1),
  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z.string().optional().default('1'),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_NAME: z.string().optional(),
  ADMIN_PHONE: z.string().optional(),

  PAYMENT_GATEWAY: z.enum(['mock', 'paystack']).default('mock'),
  PAYSTACK_SECRET_KEY: z.string().optional().default(''),
  PAYSTACK_PUBLIC_KEY: z.string().optional().default(''),
  PAYSTACK_BASE_URL: z.string().url().default('https://api.paystack.co'),
  ALLOW_MOCK_PAYMENTS: bool(true),
  PAYMENT_CURRENCY: z.string().default('NGN'),

  VTU_PROVIDER: z.enum(['mock', 'sme']).default('mock'),
  ALLOW_MOCK_VTU: bool(true),
  VTU_API_BASE_URL: z.string().optional().default(''),
  VTU_API_KEY: z.string().optional().default(''),
  VTU_TIMEOUT_MS: int(15000, 1000),
  // Optional JSON file containing the numeric cable/electricity IDs enabled on
  // the provider account. Airtime/data/status do not need it.
  VTU_CATALOGUE_FILE: z.string().optional().default(''),

  USE_QUEUES: bool(false),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  RECONCILE_INTERVAL_MS: int(300000, 30000),
  // Refresh live VTU prices and availability. Provider prices can change, so a
  // stale catalogue is a commercial risk even when the adapter is live.
  CATALOGUE_SYNC_INTERVAL_MS: int(900000, 60000),

  EMAIL_FROM: z.string().default('SubPlug <no-reply@example.com>'),
  EMAIL_HOST: z.string().optional().default(''),
  EMAIL_PORT: int(587, 1),
  EMAIL_SECURE: bool(false),
  EMAIL_USER: z.string().optional().default(''),
  EMAIL_PASSWORD: z.string().optional().default(''),
  EXPOSE_DEV_EMAILS: bool(false),
  AUTO_VERIFY_EMAILS: bool(false),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RATE_LIMIT_WINDOW_MS: int(900000, 1000),
  RATE_LIMIT_MAX: int(300, 1),
  AUTH_RATE_LIMIT_MAX: int(20, 1),
  TRANSACTION_EMAIL_ALERTS: bool(true),
  METRICS_TOKEN: z.string().optional().default(''),
  ALLOW_SANDBOX_IN_PRODUCTION: bool(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Do not leak secrets in the error output.
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration: ${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';

if (isProduction) {
  if (env.JWT_ACCESS_SECRET.includes('replace-with')) {
    throw new Error('JWT_ACCESS_SECRET must be changed before running in production');
  }
  if (env.PAYMENT_GATEWAY === 'mock' && !env.ALLOW_SANDBOX_IN_PRODUCTION) {
    throw new Error('Mock payments are not allowed in production. Configure PAYMENT_GATEWAY=paystack.');
  }
  if (env.VTU_PROVIDER === 'mock' && !env.ALLOW_SANDBOX_IN_PRODUCTION) {
    throw new Error('Mock VTU provider is not allowed in production. Configure a licensed provider.');
  }
  if (env.VTU_PROVIDER !== 'mock' && (!env.VTU_API_BASE_URL || !env.VTU_API_KEY)) {
    throw new Error('A live VTU provider requires VTU_API_BASE_URL and VTU_API_KEY.');
  }
  if (env.COOKIE_SAME_SITE === 'none' && !env.API_BASE_URL.startsWith('https://')) {
    throw new Error('SameSite=None cookies require HTTPS. Set API_BASE_URL to an https URL.');
  }
}

export const corsOrigins = [
  env.CLIENT_URL,
  ...env.ADDITIONAL_CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
];
