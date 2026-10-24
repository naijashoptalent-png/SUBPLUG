import axios, { AxiosError, AxiosInstance } from 'axios';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';
import { sanitizeProviderPayload } from '../utils/redact';
import {
  PaymentInitializeInput,
  PaymentInitializeResult,
  PaymentProvider,
  PaymentVerificationResult,
  WebhookValidationResult,
} from './paymentTypes';

interface FlutterwaveResponse<T> {
  status: string;
  message: string;
  data: T;
}

interface FlutterwaveTransaction {
  id?: number | string;
  tx_ref?: string;
  flw_ref?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  processor_response?: string;
  created_at?: string;
}

const MINOR_UNITS_PER_MAJOR = 100;

/** Flutterwave expects major units (Naira); SubPlug stores integer kobo. */
function toMajorUnits(amountMinor: number): number {
  return Number((amountMinor / MINOR_UNITS_PER_MAJOR).toFixed(2));
}

function toMinorUnits(amount: unknown): number | undefined {
  const numeric = typeof amount === 'number' ? amount : typeof amount === 'string' ? Number(amount) : Number.NaN;
  if (!Number.isFinite(numeric)) return undefined;
  return Math.round(numeric * MINOR_UNITS_PER_MAJOR);
}

/** Official Flutterwave v3 server API — https://developer.flutterwave.com/docs */
export class FlutterwaveProvider implements PaymentProvider {
  readonly key = 'flutterwave';
  readonly name = 'Flutterwave';
  readonly isSandbox: boolean;
  /** Both successful and failed charges arrive as charge.completed. */
  readonly paymentEventTypes = ['charge.completed'] as const;
  private readonly client: AxiosInstance;

  constructor() {
    if (!env.FLUTTERWAVE_SECRET_KEY) {
      throw AppError.serviceUnavailable(
        'Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY (test key in development).',
        'FLUTTERWAVE_NOT_CONFIGURED'
      );
    }
    // Flutterwave test secret keys start with FLWSECK_TEST-; live keys with FLWSECK-.
    this.isSandbox = env.FLUTTERWAVE_SECRET_KEY.startsWith('FLWSECK_TEST');
    this.client = axios.create({
      baseURL: env.FLUTTERWAVE_BASE_URL,
      timeout: 20_000,
      headers: {
        Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async initialize(input: PaymentInitializeInput): Promise<PaymentInitializeResult> {
    try {
      const { data } = await this.client.post<FlutterwaveResponse<{ link: string }>>('/payments', {
        tx_ref: input.reference,
        amount: toMajorUnits(input.amountMinor),
        currency: input.currency,
        redirect_url: input.callbackUrl,
        customer: { email: input.email },
        meta: input.metadata ?? {},
        customizations: { title: 'SubPlug wallet funding' },
      });
      if (data.status !== 'success' || !data.data?.link) {
        throw new Error(data.message || 'Flutterwave rejected initialization');
      }
      return {
        authorizationUrl: data.data.link,
        // Verification is by tx_ref (our own reference), not the numeric
        // Flutterwave transaction ID, so no extra identifier is required here.
        gatewayReference: input.reference,
        isSandbox: this.isSandbox,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error(
        {
          status: axiosError.response?.status,
          response: sanitizeProviderPayload(axiosError.response?.data),
        },
        'Flutterwave initialization failed'
      );
      throw AppError.serviceUnavailable(
        'The payment gateway could not initialize this payment. Please try again later.',
        'PAYMENT_GATEWAY_UNAVAILABLE'
      );
    }
  }

  async verify(reference: string): Promise<PaymentVerificationResult> {
    try {
      const { data } = await this.client.get<FlutterwaveResponse<FlutterwaveTransaction>>(
        '/transactions/verify_by_reference',
        { params: { tx_ref: reference } }
      );

      if (data.status !== 'success' || !data.data) {
        return { outcome: 'UNCERTAIN', message: data.message, raw: sanitizeProviderPayload(data) };
      }
      const tx = data.data;
      if (!tx.tx_ref || tx.tx_ref !== reference) {
        return { outcome: 'UNCERTAIN', message: 'Gateway reference mismatch', raw: sanitizeProviderPayload(tx) };
      }

      let outcome: PaymentVerificationResult['outcome'];
      switch (String(tx.status ?? '').toLowerCase()) {
        case 'successful':
          outcome = 'SUCCESSFUL';
          break;
        case 'failed':
        case 'cancelled':
        case 'reversed':
          outcome = 'FAILED';
          break;
        case 'pending':
        case 'processing':
          outcome = 'PENDING';
          break;
        default:
          outcome = 'UNCERTAIN';
      }

      const created = tx.created_at ? new Date(tx.created_at) : undefined;
      return {
        outcome,
        amountMinor: toMinorUnits(tx.amount),
        currency: tx.currency ? tx.currency.toUpperCase() : undefined,
        gatewayReference: tx.tx_ref,
        paidAt: created && !Number.isNaN(created.getTime()) ? created : undefined,
        message: tx.processor_response ?? tx.status,
        raw: sanitizeProviderPayload(tx),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error(
        {
          status: axiosError.response?.status,
          reference,
          response: sanitizeProviderPayload(axiosError.response?.data),
        },
        'Flutterwave verification failed'
      );
      return {
        outcome: 'UNCERTAIN',
        message: 'Payment gateway verification could not be completed',
        raw: sanitizeProviderPayload(axiosError.response?.data),
      };
    }
  }

  /**
   * Flutterwave sends the secret hash configured in the dashboard in the
   * `verif-hash` header. It is a shared secret, not an HMAC of the body.
   */
  parseWebhook(rawBody: Buffer | string, signature: string | undefined): WebhookValidationResult {
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const expected = env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
    let valid = false;
    if (expected && signature && signature.length === expected.length) {
      valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(body.toString('utf8')) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    const data = (parsed.data ?? {}) as Record<string, unknown>;
    const eventType = String(parsed.event ?? 'unknown');
    const status = String(data.status ?? '').toLowerCase();
    const transactionId = data.id !== undefined ? String(data.id) : String(data.flw_ref ?? '');
    // The same transaction can be re-delivered when its status changes, so the
    // status is part of the deduplication key.
    const eventId = transactionId
      ? `${transactionId}${status ? `:${status}` : ''}`
      : `flutterwave_${Date.now()}`;
    return {
      valid,
      eventId,
      eventType,
      reference: String(data.tx_ref ?? ''),
      payload: parsed,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const { data } = await this.client.get<FlutterwaveResponse<unknown>>('/balances');
      return {
        healthy: data?.status === 'success',
        message: data?.status === 'success' ? 'Flutterwave API reachable' : 'Flutterwave returned an unhealthy response',
      };
    } catch (error) {
      return { healthy: false, message: error instanceof Error ? error.message : 'Flutterwave unreachable' };
    }
  }
}
