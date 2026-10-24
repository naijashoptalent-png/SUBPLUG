import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { FlutterwaveProvider } from '../src/providers/flutterwaveProvider';

function installAdapter(
  provider: FlutterwaveProvider,
  respond: (config: InternalAxiosRequestConfig) => unknown
) {
  const client = (provider as unknown as { client: AxiosInstance }).client;
  client.defaults.adapter = async (config) =>
    ({
      data: respond(config),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }) as AxiosResponse;
}

function payloadOf(config: InternalAxiosRequestConfig | undefined): Record<string, unknown> {
  const data = config?.data;
  if (typeof data === 'string') return JSON.parse(data) as Record<string, unknown>;
  return (data ?? {}) as Record<string, unknown>;
}

describe('Flutterwave provider', () => {
  it('creates a permanent NIN-backed virtual account', async () => {
    const provider = new FlutterwaveProvider();
    let captured: InternalAxiosRequestConfig | undefined;
    installAdapter(provider, (config) => {
      captured = config;
      return {
        status: 'success',
        message: 'Virtual account created',
        data: { account_number: '1234567890', bank_name: 'Flutterwave MFB', flw_ref: 'FLW_VA_1' },
      };
    });

    const result = await provider.createStaticVirtualAccount({
      email: 'customer@example.com',
      phone: '+2348012345678',
      fullName: 'Jane Doe',
      nin: '12345678901',
      reference: 'VA_abc123',
    });

    expect(captured?.url).toBe('/virtual-account-numbers');
    expect(payloadOf(captured)).toMatchObject({
      email: 'customer@example.com',
      phonenumber: '08012345678',
      firstname: 'Jane',
      lastname: 'Doe',
      nin: '12345678901',
      is_permanent: true,
      tx_ref: 'VA_abc123',
    });
    expect(result).toEqual({
      accountNumber: '1234567890',
      bankName: 'Flutterwave MFB',
      providerReference: 'FLW_VA_1',
      orderReference: undefined,
    });
  });

  it('initializes checkout with Naira major units and the shared reference', async () => {
    const provider = new FlutterwaveProvider();
    let captured: InternalAxiosRequestConfig | undefined;
    installAdapter(provider, (config) => {
      captured = config;
      return {
        status: 'success',
        message: 'Hosted Link',
        data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/test' },
      };
    });

    const result = await provider.initialize({
      reference: 'FUND_FLW_1',
      email: 'customer@example.com',
      amountMinor: 250_050,
      currency: 'NGN',
      callbackUrl: 'https://app.example.com/wallet/funding/callback',
      metadata: { userId: 'user-1' },
    });

    expect(captured?.url).toBe('/payments');
    expect(payloadOf(captured)).toMatchObject({
      tx_ref: 'FUND_FLW_1',
      amount: 2500.5,
      currency: 'NGN',
      redirect_url: 'https://app.example.com/wallet/funding/callback',
      customer: { email: 'customer@example.com' },
      meta: { userId: 'user-1' },
    });
    expect(result.authorizationUrl).toContain('checkout.flutterwave.com');
    expect(result.gatewayReference).toBe('FUND_FLW_1');
    expect(result.isSandbox).toBe(true);
  });

  it('maps a successful verification and converts major units back to kobo', async () => {
    const provider = new FlutterwaveProvider();
    installAdapter(provider, () => ({
      status: 'success',
      message: 'Transaction fetched successfully',
      data: {
        id: 3091255,
        tx_ref: 'FUND_FLW_2',
        amount: 2500.5,
        currency: 'NGN',
        status: 'successful',
        processor_response: 'Approved',
        created_at: '2026-10-20T10:00:00.000Z',
      },
    }));

    const result = await provider.verify('FUND_FLW_2');

    expect(result.outcome).toBe('SUCCESSFUL');
    expect(result.amountMinor).toBe(250_050);
    expect(result.currency).toBe('NGN');
    expect(result.gatewayReference).toBe('FUND_FLW_2');
    expect(result.paidAt?.toISOString()).toBe('2026-10-20T10:00:00.000Z');
  });

  it('maps failed and pending transaction statuses', async () => {
    const provider = new FlutterwaveProvider();
    let status = 'failed';
    installAdapter(provider, () => ({
      status: 'success',
      message: 'Transaction fetched successfully',
      data: { id: 1, tx_ref: 'FUND_FLW_3', amount: 100, currency: 'NGN', status },
    }));

    expect((await provider.verify('FUND_FLW_3')).outcome).toBe('FAILED');
    status = 'pending';
    expect((await provider.verify('FUND_FLW_3')).outcome).toBe('PENDING');
  });

  it('treats a mismatched tx_ref as uncertain', async () => {
    const provider = new FlutterwaveProvider();
    installAdapter(provider, () => ({
      status: 'success',
      message: 'Transaction fetched successfully',
      data: { id: 1, tx_ref: 'SOME_OTHER_REF', amount: 100, currency: 'NGN', status: 'successful' },
    }));

    const result = await provider.verify('FUND_FLW_4');

    expect(result.outcome).toBe('UNCERTAIN');
    expect(result.message).toContain('mismatch');
  });
});

describe('Flutterwave webhook signatures', () => {
  const provider = new FlutterwaveProvider();

  function payload(reference = 'FUND_FLW_WEBHOOK', status = 'successful') {
    return {
      event: 'charge.completed',
      data: { id: 285959875, tx_ref: reference, status, amount: 100, currency: 'NGN' },
    };
  }

  it('accepts the configured verif-hash secret', () => {
    const raw = Buffer.from(JSON.stringify(payload()));

    const result = provider.parseWebhook(raw, env.FLUTTERWAVE_WEBHOOK_SECRET_HASH);

    expect(result.valid).toBe(true);
    expect(result.eventType).toBe('charge.completed');
    expect(result.reference).toBe('FUND_FLW_WEBHOOK');
    expect(result.eventId).toBe('285959875:successful');
  });

  it('rejects missing and wrong hashes', () => {
    const raw = Buffer.from(JSON.stringify(payload()));

    expect(provider.parseWebhook(raw, undefined).valid).toBe(false);
    expect(provider.parseWebhook(raw, 'wrong-hash').valid).toBe(false);
    expect(provider.parseWebhook(raw, `${env.FLUTTERWAVE_WEBHOOK_SECRET_HASH}x`).valid).toBe(false);
  });

  it('uses the status in the event key so a later success is not deduplicated', () => {
    const failed = provider.parseWebhook(
      Buffer.from(JSON.stringify(payload('FUND_FLW_WEBHOOK', 'failed'))),
      env.FLUTTERWAVE_WEBHOOK_SECRET_HASH
    );
    const successful = provider.parseWebhook(
      Buffer.from(JSON.stringify(payload('FUND_FLW_WEBHOOK', 'successful'))),
      env.FLUTTERWAVE_WEBHOOK_SECRET_HASH
    );

    expect(failed.eventId).not.toBe(successful.eventId);
  });
});
