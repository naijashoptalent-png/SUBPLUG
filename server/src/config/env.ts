import dotenv from 'dotenv';
import { z } from 'zod';
import { parsePaymentGatewayList, PAYMENT_GATEWAY_KEYS, type PaymentGatewayKey } from './paymentGateways';

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

  // PAYMENT_GATEWAY is the default (pre-selected) method. PAYMENT_GATEWAYS
  // adds other gateways that customers may choose per top-up.
  PAYMENT_GATEWAY: z.enum(PAYMENT_GATEWAY_KEYS).default('mock'),
  PAYMENT_GATEWAYS: z
    .string()
    .optional()
    .default('')
    .transform(parsePaymentGatewayList)
    .pipe(z.array(z.enum(PAYMENT_GATEWAY_KEYS))),
  PAYSTACK_SECRET_KEY: z.string().optional().default(''),
  PAYSTACK_PUBLIC_KEY: z.string().optional().default(''),
  PAYSTACK_BASE_URL: z.string().url().default('https://api.paystack.co'),
  FLUTTERWAVE_SECRET_KEY: z.string().optional().default(''),
  FLUTTERWAVE_PUBLIC_KEY: z.string().optional().default(''),
  FLUTTERWAVE_BASE_URL: z.string().url().default('https://api.flutterwave.com/v3'),
  // Secret hash configured on the Flutterwave dashboard webhook. Flutterwave
  // sends it in the verif-hash header; without it the webhook is rejected.
  FLUTTERWAVE_WEBHOOK_SECRET_HASH: z.string().optional().default(''),
  ALLOW_MOCK_PAYMENTS: bool(true),
  PAYMENT_CURRENCY: z.string().default('NGN'),

  VTU_PROVIDER: z.enum(['mock', 'sme', 'maskawasub']).default('mock'),
  // Optional secondary provider used for catalogue/health checks and for any
  // service explicitly routed to it. Purchases are never retried automatically
  // on another provider after submission.
  VTU_BACKUP_PROVIDER: z.enum(['', 'mock', 'sme', 'maskawasub']).default(''),
  // Explicit routes for the two highest-volume services. Empty uses
  // VTU_PROVIDER; an override changes selection before debit, never after
  // submission.
  VTU_AIRTIME_PROVIDER: z.enum(['', 'mock', 'sme', 'maskawasub']).default(''),
  VTU_DATA_PROVIDER: z.enum(['', 'mock', 'sme', 'maskawasub']).default(''),
  ALLOW_MOCK_VTU: bool(true),
  VTU_API_BASE_URL: z.string().optional().default(''),
  VTU_API_KEY: z.string().optional().default(''),
  VTU_TIMEOUT_MS: int(15000, 1000),
  // Optional JSON file containing the numeric cable/electricity IDs enabled on
  // the SME account. Airtime/data/status do not need it.
  VTU_CATALOGUE_FILE: z.string().optional().default(''),

  // Cable and electricity are fixed to MaskawaSub in the provider resolver.
  // These values are retained for deployment compatibility but do not select
  // another provider. Education/airtime-to-cash/recharge-card remain reserved
  // and, when implemented, must also be MaskawaSub-only.
  VTU_CABLE_PROVIDER: z.enum(['', 'mock', 'sme', 'maskawasub']).default(''),
  VTU_ELECTRICITY_PROVIDER: z.enum(['', 'mock', 'sme', 'maskawasub']).default(''),
  VTU_EDUCATION_PROVIDER: z.enum(['', 'mock', 'sme', 'maskawasub']).default(''),
  VTU_AIRTIME_TO_CASH_PROVIDER: z.enum(['', 'mock', 'sme', 'maskawasub']).default(''),
  VTU_RECHARGE_CARD_PROVIDER: z.enum(['', 'mock', 'sme', 'maskawasub']).default(''),

  // MaskawaSub is a secondary provider. Its purchase/status contracts must be
  // certified before this flag is enabled; until then reads (catalogue/health)
  // are allowed but every live purchase fails closed before any wallet debit.
  MASKAWASUB_API_BASE_URL: z.string().url().default('https://maskawasub.com'),
  MASKAWASUB_API_KEY: z.string().optional().default(''),
  MASKAWASUB_LIVE_PURCHASES: bool(false),
  // Comma-separated allowlist of services individually certified for live
  // MaskawaSub purchases. Empty means none; the global flag alone never enables
  // a service.
  MASKAWASUB_CERTIFIED_SERVICES: z.string().optional().default(''),

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

/**
 * Gateways offered to customers, in display order. The default gateway is
 * always included; PAYMENT_GATEWAYS adds the others.
 */
export const enabledPaymentGatewayKeys: PaymentGatewayKey[] = Array.from(
  new Set<PaymentGatewayKey>([env.PAYMENT_GATEWAY, ...env.PAYMENT_GATEWAYS])
);

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';

if (isProduction) {
  if (env.JWT_ACCESS_SECRET.includes('replace-with')) {
    throw new Error('JWT_ACCESS_SECRET must be changed before running in production');
  }
  if (env.PAYMENT_GATEWAY === 'mock' && !env.ALLOW_SANDBOX_IN_PRODUCTION) {
    throw new Error(
      'Mock payments are not allowed in production. Configure PAYMENT_GATEWAY=paystack or PAYMENT_GATEWAY=flutterwave.'
    );
  }
  for (const key of enabledPaymentGatewayKeys) {
    if (key === 'mock' && !env.ALLOW_SANDBOX_IN_PRODUCTION) {
      throw new Error('The mock payment gateway is not allowed in production. Remove it from PAYMENT_GATEWAYS.');
    }
    if (key === 'paystack' && !env.PAYSTACK_SECRET_KEY) {
      throw new Error('The Paystack gateway requires PAYSTACK_SECRET_KEY.');
    }
    if (key === 'flutterwave' && !env.FLUTTERWAVE_SECRET_KEY) {
      throw new Error('The Flutterwave gateway requires FLUTTERWAVE_SECRET_KEY.');
    }
    if (key === 'flutterwave' && !env.FLUTTERWAVE_WEBHOOK_SECRET_HASH) {
      throw new Error(
        'The Flutterwave gateway requires FLUTTERWAVE_WEBHOOK_SECRET_HASH (the secret hash set on the dashboard webhook).'
      );
    }
  }
  if (env.VTU_PROVIDER === 'mock' && !env.ALLOW_SANDBOX_IN_PRODUCTION) {
    throw new Error('Mock VTU provider is not allowed in production. Configure a licensed provider.');
  }
  const configuredVtuProviders = new Set(
    [
      env.VTU_PROVIDER,
      env.VTU_BACKUP_PROVIDER,
      env.VTU_CABLE_PROVIDER,
      env.VTU_ELECTRICITY_PROVIDER,
      env.VTU_EDUCATION_PROVIDER,
      env.VTU_AIRTIME_TO_CASH_PROVIDER,
      env.VTU_RECHARGE_CARD_PROVIDER,
    ].filter(Boolean)
  );
  if (configuredVtuProviders.has('mock') && !env.ALLOW_SANDBOX_IN_PRODUCTION) {
    throw new Error('Mock VTU provider is not allowed in production. Configure a licensed provider.');
  }
  const liveVtuProviders = new Set([...configuredVtuProviders].filter((key) => key !== 'mock'));
  if (liveVtuProviders.has('sme') && (!env.VTU_API_BASE_URL || !env.VTU_API_KEY)) {
    throw new Error('The SME VTU provider requires VTU_API_BASE_URL and VTU_API_KEY.');
  }
  if (liveVtuProviders.has('maskawasub') && !env.MASKAWASUB_API_KEY) {
    throw new Error('The MaskawaSub VTU provider requires MASKAWASUB_API_KEY.');
  }
  if (env.COOKIE_SAME_SITE === 'none' && !env.API_BASE_URL.startsWith('https://')) {
    throw new Error('SameSite=None cookies require HTTPS. Set API_BASE_URL to an https URL.');
  }
}

export const corsOrigins = [
  env.CLIENT_URL,
  ...env.ADDITIONAL_CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
];
