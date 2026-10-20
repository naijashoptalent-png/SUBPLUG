import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { MockPaymentProvider } from '../src/providers/mockPaymentProvider';
import { MockVtuProvider } from '../src/providers/mockVtuProvider';
import { PaystackProvider } from '../src/providers/paystackProvider';
import { ProviderPurchaseRequest } from '../src/providers/types';

function request(overrides: Partial<ProviderPurchaseRequest> = {}): ProviderPurchaseRequest {
  return {
    reference: `TEST-${Math.random().toString(36).slice(2).toUpperCase()}`,
    service: 'AIRTIME',
    network: 'MTN',
    phone: '+2348012345678',
    amountMinor: 5_000,
    ...overrides,
  };
}

describe('Paystack webhook signatures', () => {
  const provider = new PaystackProvider();

  function payload(reference = 'FUND_TEST_1') {
    return {
      event: 'charge.success',
      data: { id: 987654, reference, amount: 150_000, currency: 'NGN', status: 'success' },
    };
  }

  it('accepts an HMAC-SHA512 signature over the exact raw body', () => {
    const raw = Buffer.from(JSON.stringify(payload()));
    const signature = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');

    const result = provider.parseWebhook(raw, signature);

    expect(result.valid).toBe(true);
    expect(result.eventType).toBe('charge.success');
    expect(result.eventId).toBe('987654');
    expect(result.reference).toBe('FUND_TEST_1');
  });

  it('rejects a signature when the body was altered after signing', () => {
    const raw = Buffer.from(JSON.stringify(payload()));
    const signature = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');
    const tampered = Buffer.from(raw.toString('utf8').replace('150000', '1'));

    expect(provider.parseWebhook(tampered, signature).valid).toBe(false);
  });

  it('rejects missing, malformed, and wrong-length signatures without throwing', () => {
    const raw = Buffer.from(JSON.stringify(payload()));

    expect(provider.parseWebhook(raw, undefined).valid).toBe(false);
    expect(provider.parseWebhook(raw, 'not-hex').valid).toBe(false);
    expect(provider.parseWebhook(raw, 'a'.repeat(128)).valid).toBe(false);
  });

  it('cannot be validated with the sandbox payment secret', () => {
    const raw = Buffer.from(JSON.stringify(payload()));
    const wrongSignature = createHmac('sha512', env.JWT_ACCESS_SECRET).update(raw).digest('hex');

    expect(provider.parseWebhook(raw, wrongSignature).valid).toBe(false);
  });
});

describe('sandbox payment provider', () => {
  it('creates a payable checkout and verifies only after markPaid', async () => {
    const provider = new MockPaymentProvider();
    const reference = 'FUND_SANDBOX_1';

    const initialized = await provider.initialize({
      reference,
      email: 'customer@example.com',
      amountMinor: 25_000,
      currency: 'NGN',
      callbackUrl: 'http://localhost:5173/wallet/funding/callback',
    });

    expect(initialized.isSandbox).toBe(true);
    expect(initialized.authorizationUrl).toContain(`reference=${reference}`);
    expect((await provider.verify(reference)).outcome).toBe('PENDING');

    expect(provider.markPaid(reference)).toBe(true);
    const verified = await provider.verify(reference);
    expect(verified.outcome).toBe('SUCCESSFUL');
    expect(verified.amountMinor).toBe(25_000);
    expect(verified.currency).toBe('NGN');
  });

  it('returns FAILED when the sandbox payment is marked failed', async () => {
    const provider = new MockPaymentProvider();
    const reference = 'FUND_SANDBOX_2';
    await provider.initialize({
      reference,
      email: 'customer@example.com',
      amountMinor: 10_000,
      currency: 'NGN',
      callbackUrl: 'http://localhost:5173/callback',
    });
    provider.markFailed(reference);

    expect((await provider.verify(reference)).outcome).toBe('FAILED');
  });
});

describe('sandbox VTU provider', () => {
  const provider = new MockVtuProvider();

  it('returns a successful sandbox result for normal recipients', async () => {
    const result = await provider.purchase(request({ phone: '+2348012345678' }));

    expect(result.outcome).toBe('SUCCESS');
    expect(result.providerReference).toMatch(/^MOCK-/);
    expect(result.token).toBeUndefined();
    expect(result.raw).toEqual({ sandbox: true });
  });

  it('maps deterministic recipient endings to failed, pending, and uncertain outcomes', async () => {
    const failed = await provider.purchase(request({ phone: '+2348012340000' }));
    const pending = await provider.purchase(request({ phone: '+2348012341111' }));
    const uncertain = await provider.purchase(request({ phone: '+2348012342222' }));

    expect(failed.outcome).toBe('FAILED');
    expect(failed.message).toContain('0000');
    expect(pending.outcome).toBe('PENDING');
    expect(pending.providerStatus).toBe('PENDING');
    expect(uncertain.outcome).toBe('UNCERTAIN');
    expect(uncertain.message).toContain('timeout');
  });

  it('issues clearly labelled sandbox electricity tokens only on success', async () => {
    const success = await provider.purchase(
      request({
        service: 'ELECTRICITY',
        network: undefined,
        phone: undefined,
        meterNumber: '1234567890',
        meterType: 'PREPAID',
        disco: 'IKEDC',
      })
    );
    const failed = await provider.purchase(
      request({
        service: 'ELECTRICITY',
        network: undefined,
        phone: '+2348012340000',
        meterNumber: '1234567890',
        meterType: 'PREPAID',
        disco: 'IKEDC',
      })
    );

    expect(success.outcome).toBe('SUCCESS');
    expect(success.token).toMatch(/^SANDBOX-/);
    expect(success.customerName).toContain('SANDBOX');
    expect(failed.outcome).toBe('FAILED');
    expect(failed.token).toBeUndefined();
  });

  it('remembers a purchase so status queries return the same outcome', async () => {
    const input = request({ phone: '+2348012345678' });
    const purchase = await provider.purchase(input);
    const status = await provider.queryStatus(input.reference);

    expect(status.outcome).toBe(purchase.outcome);
    expect(status.providerReference).toBe(purchase.providerReference);
  });

  it('validates sandbox meters and smartcards with explicit demo-data messaging', async () => {
    const meter = await provider.validateMeter({
      disco: 'IKEDC',
      meterNumber: '1234567890',
      meterType: 'PREPAID',
    });
    const unknownDisco = await provider.validateMeter({
      disco: 'NOPE',
      meterNumber: '1234567890',
      meterType: 'PREPAID',
    });
    const badMeter = await provider.validateMeter({
      disco: 'IKEDC',
      meterNumber: '123',
      meterType: 'PREPAID',
    });
    const smartcard = await provider.validateSmartcard({
      provider: 'DSTV',
      smartcardNumber: '12345678',
    });
    const badSmartcard = await provider.validateSmartcard({
      provider: 'DSTV',
      smartcardNumber: '123',
    });

    expect(meter.valid).toBe(true);
    expect(meter.isSandbox).toBe(true);
    expect(meter.customerName).toContain('SANDBOX');
    expect(unknownDisco.valid).toBe(false);
    expect(badMeter.valid).toBe(false);
    expect(smartcard.valid).toBe(true);
    expect(smartcard.customerName).toContain('SANDBOX');
    expect(badSmartcard.valid).toBe(false);
  });

  it('falls back to PENDING for an unknown reference after a restart', async () => {
    const status = await provider.queryStatus('UNKNOWN-REFERENCE');

    expect(status.outcome).toBe('PENDING');
    expect(status.providerStatus).toBe('UNKNOWN_IN_SANDBOX');
  });
});
