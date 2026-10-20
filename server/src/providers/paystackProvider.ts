import axios, { AxiosError, AxiosInstance } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
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

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

/** Official Paystack server API — https://paystack.com/docs/api/ */
export class PaystackProvider implements PaymentProvider {
  readonly key = 'paystack';
  readonly name = 'Paystack';
  readonly isSandbox: boolean;
  private readonly client: AxiosInstance;

  constructor() {
    if (!env.PAYSTACK_SECRET_KEY) {
      throw AppError.serviceUnavailable(
        'Paystack is not configured. Set PAYSTACK_SECRET_KEY (test key in development).',
        'PAYSTACK_NOT_CONFIGURED'
      );
    }
    // Paystack test secret keys start with sk_test_; live keys with sk_live_.
    this.isSandbox = env.PAYSTACK_SECRET_KEY.startsWith('sk_test_');
    this.client = axios.create({
      baseURL: env.PAYSTACK_BASE_URL,
      timeout: 20_000,
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async initialize(input: PaymentInitializeInput): Promise<PaymentInitializeResult> {
    try {
      const { data } = await this.client.post<PaystackResponse<{
        authorization_url: string;
        access_code: string;
        reference: string;
      }>>('/transaction/initialize', {
        email: input.email,
        amount: input.amountMinor,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata ?? {},
      });
      if (!data.status || !data.data?.authorization_url) {
        throw new Error(data.message || 'Paystack rejected initialization');
      }
      return {
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
        gatewayReference: data.data.reference,
        isSandbox: this.isSandbox,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error(
        {
          status: axiosError.response?.status,
          response: sanitizeProviderPayload(axiosError.response?.data),
        },
        'Paystack initialization failed'
      );
      throw AppError.serviceUnavailable(
        'The payment gateway could not initialize this payment. Please try again later.',
        'PAYMENT_GATEWAY_UNAVAILABLE'
      );
    }
  }

  async verify(reference: string): Promise<PaymentVerificationResult> {
    try {
      const { data } = await this.client.get<PaystackResponse<{
        status: string;
        reference: string;
        amount: number;
        currency: string;
        paid_at?: string;
        gateway_response?: string;
      }>>(`/transaction/verify/${encodeURIComponent(reference)}`);

      if (!data.status || !data.data) {
        return { outcome: 'UNCERTAIN', message: data.message, raw: sanitizeProviderPayload(data) };
      }
      const tx = data.data;
      const paidAt = tx.paid_at ? new Date(tx.paid_at) : undefined;
      if (!tx.reference || tx.reference !== reference) {
        return { outcome: 'UNCERTAIN', message: 'Gateway reference mismatch', raw: sanitizeProviderPayload(tx) };
      }

      let outcome: PaymentVerificationResult['outcome'];
      switch (tx.status) {
        case 'success':
          outcome = 'SUCCESSFUL';
          break;
        case 'failed':
        case 'reversed':
          outcome = 'FAILED';
          break;
        case 'abandoned':
        case 'ongoing':
        case 'pending':
        case 'processing':
        case 'queued':
          outcome = 'PENDING';
          break;
        default:
          outcome = 'UNCERTAIN';
      }
      return {
        outcome,
        amountMinor: tx.amount,
        currency: tx.currency,
        gatewayReference: tx.reference,
        paidAt,
        message: tx.gateway_response,
        raw: sanitizeProviderPayload(tx),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error(
        { status: axiosError.response?.status, reference, response: sanitizeProviderPayload(axiosError.response?.data) },
        'Paystack verification failed'
      );
      return {
        outcome: 'UNCERTAIN',
        message: 'Payment gateway verification could not be completed',
        raw: sanitizeProviderPayload(axiosError.response?.data),
      };
    }
  }

  /**
   * x-paystack-signature = HMAC SHA512 of the RAW request body using the secret key.
   * Must be computed over the untouched bytes, not re-serialized JSON.
   */
  parseWebhook(rawBody: Buffer | string, signature: string | undefined): WebhookValidationResult {
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const expected = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(body).digest('hex');
    let valid = false;
    if (signature && signature.length === expected.length) {
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
    const id = data.id !== undefined ? String(data.id) : String(parsed.event ?? '');
    return {
      valid,
      eventId: id || `paystack_${Date.now()}`,
      eventType,
      reference: String(data.reference ?? ''),
      payload: parsed,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const { data } = await this.client.get('/transaction?perPage=1');
      return { healthy: Boolean(data?.status), message: 'Paystack API reachable' };
    } catch (error) {
      return { healthy: false, message: error instanceof Error ? error.message : 'Paystack unreachable' };
    }
  }
}
