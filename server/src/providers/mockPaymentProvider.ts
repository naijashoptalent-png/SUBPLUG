import { createHmac } from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import {
  PaymentInitializeInput,
  PaymentInitializeResult,
  PaymentProvider,
  PaymentVerificationResult,
  WebhookValidationResult,
} from './paymentTypes';

interface SandboxPayment {
  reference: string;
  amountMinor: number;
  currency: string;
  paid: boolean;
  failed: boolean;
}

/**
 * SANDBOX payment adapter. No money moves. It is enabled only outside
 * production and every funding record created through it is flagged
 * isSandbox. The UI must display a sandbox banner.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly key = 'mock';
  readonly name = 'Sandbox Payment Gateway';
  readonly isSandbox = true;
  private readonly payments = new Map<string, SandboxPayment>();

  async initialize(input: PaymentInitializeInput): Promise<PaymentInitializeResult> {
    if (env.NODE_ENV === 'production' && !env.ALLOW_SANDBOX_IN_PRODUCTION) {
      throw new Error('Sandbox payments are disabled in production');
    }
    this.payments.set(input.reference, {
      reference: input.reference,
      amountMinor: input.amountMinor,
      currency: input.currency,
      paid: false,
      failed: false,
    });
    logger.info({ reference: input.reference }, 'SANDBOX payment initialized — no real charge');
    const url = new URL('/mock-payment', env.CLIENT_URL);
    url.searchParams.set('reference', input.reference);
    return {
      authorizationUrl: url.toString(),
      gatewayReference: input.reference,
      isSandbox: true,
    };
  }

  async verify(reference: string): Promise<PaymentVerificationResult> {
    const payment = this.payments.get(reference);
    if (!payment) {
      return { outcome: 'PENDING', message: 'Sandbox payment not found or server restarted', raw: { sandbox: true } };
    }
    if (payment.failed) {
      return {
        outcome: 'FAILED',
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        gatewayReference: reference,
        message: 'Sandbox payment marked as failed',
        raw: { sandbox: true },
      };
    }
    if (!payment.paid) {
      return {
        outcome: 'PENDING',
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        gatewayReference: reference,
        message: 'Sandbox payment awaiting confirmation',
        raw: { sandbox: true },
      };
    }
    return {
      outcome: 'SUCCESSFUL',
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      gatewayReference: reference,
      paidAt: new Date(),
      message: 'Sandbox payment confirmed (no real money)',
      raw: { sandbox: true },
    };
  }

  /** Development-only helper used by the simulated checkout. */
  markPaid(reference: string): boolean {
    const payment = this.payments.get(reference);
    if (!payment) return false;
    payment.paid = true;
    return true;
  }

  markFailed(reference: string): boolean {
    const payment = this.payments.get(reference);
    if (!payment) return false;
    payment.failed = true;
    return true;
  }

  parseWebhook(rawBody: Buffer | string, signature: string | undefined): WebhookValidationResult {
    // The sandbox never accepts public "webhooks"; a local HMAC keeps this
    // method testable without contacting the network.
    const expected = createHmac('sha512', env.JWT_ACCESS_SECRET).update(rawBody).digest('hex');
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    return {
      valid: Boolean(signature) && signature === expected,
      eventId: String(parsed.eventId ?? `mock_${Date.now()}`),
      eventType: String(parsed.event ?? 'unknown'),
      reference: String(parsed.reference ?? ''),
      payload: parsed,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true, message: 'Sandbox payment gateway ready' };
  }
}
