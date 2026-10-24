import { createHmac } from 'crypto';
import { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { LedgerEntry, PaymentEvent, WalletFunding } from '../src/models';
import { getPaymentProvider } from '../src/providers/paymentIndex';
import { MockPaymentProvider } from '../src/providers/mockPaymentProvider';
import { getManualFundingSettings, getPublicSettings, updateSetting } from '../src/services/settingsService';
import { approveManualFunding } from '../src/services/adminService';
import {
  confirmFunding,
  createManualFundingRequest,
  handlePaymentWebhook,
  initializeFunding,
  simulateSandboxPayment,
} from '../src/services/fundingService';
import { getWallet } from '../src/services/walletService';
import { createUser, uniqueReference } from './helpers';

const fakeReq = {
  ip: '127.0.0.1',
  get: () => 'vitest',
} as unknown as Request;

function mockGateway(): MockPaymentProvider {
  const provider = getPaymentProvider();
  if (!(provider instanceof MockPaymentProvider)) {
    throw new Error('Expected the sandbox payment provider in tests');
  }
  return provider;
}

async function startFunding(userId: string, amountMinor = 25_000) {
  return initializeFunding({
    userId,
    amountMinor,
    idempotencyKey: uniqueReference('fund'),
    req: fakeReq,
  });
}

describe('wallet funding initialization', () => {
  it('creates a pending sandbox funding record and returns a checkout URL', async () => {
    const user = await createUser();
    const result = await startFunding(String(user._id));

    expect(result.status).toBe('PENDING');
    expect(result.duplicate).toBe(false);
    expect(result.isSandbox).toBe(true);
    expect(result.authorizationUrl).toContain('/mock-payment?reference=');
    expect(result.authorizationUrl).toContain(result.reference);

    const stored = await WalletFunding.findOne({ reference: result.reference }).lean();
    expect(stored?.amountMinor).toBe(25_000);
    expect(stored?.isSandbox).toBe(true);
    expect(stored?.gateway).toBe('mock');
    expect(stored?.paidAt).toBeFalsy();
    expect(stored?.creditedAt).toBeFalsy();
  });

  it('replays the same funding request without creating a second record', async () => {
    const user = await createUser();
    const key = uniqueReference('fund-idem');
    const initialize = () =>
      initializeFunding({
        userId: String(user._id),
        amountMinor: 25_000,
        idempotencyKey: key,
        req: fakeReq,
      });

    const first = await initialize();
    const second = await initialize();

    expect(second.duplicate).toBe(true);
    expect(second.reference).toBe(first.reference);
    expect(await WalletFunding.countDocuments({ userId: user._id })).toBe(1);
  });

  it('rejects key reuse for a different funding amount', async () => {
    const user = await createUser();
    const key = uniqueReference('fund-mismatch');
    await initializeFunding({
      userId: String(user._id),
      amountMinor: 25_000,
      idempotencyKey: key,
      req: fakeReq,
    });

    await expect(
      initializeFunding({
        userId: String(user._id),
        amountMinor: 30_000,
        idempotencyKey: key,
        req: fakeReq,
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_MISMATCH' });

    expect(await WalletFunding.countDocuments({ userId: user._id })).toBe(1);
  });

  it('rejects key reuse when the payment gateway changes', async () => {
    const user = await createUser();
    const key = uniqueReference('fund-gateway-mismatch');
    await initializeFunding({
      userId: String(user._id),
      amountMinor: 25_000,
      idempotencyKey: key,
      req: fakeReq,
    });

    await expect(
      initializeFunding({
        userId: String(user._id),
        amountMinor: 25_000,
        gateway: 'paystack',
        idempotencyKey: key,
        req: fakeReq,
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_MISMATCH' });

    expect(await WalletFunding.countDocuments({ userId: user._id })).toBe(1);
  });

  it('refuses a gateway that is not enabled for customers', async () => {
    const user = await createUser();

    await expect(
      initializeFunding({
        userId: String(user._id),
        amountMinor: 25_000,
        gateway: 'paystack',
        idempotencyKey: uniqueReference('fund-gateway'),
        req: fakeReq,
      })
    ).rejects.toMatchObject({ code: 'PAYMENT_GATEWAY_UNAVAILABLE' });

    expect(await WalletFunding.countDocuments({ userId: user._id })).toBe(0);
  });

  it('enforces the configured minimum funding amount', async () => {
    const user = await createUser();

    await expect(startFunding(String(user._id), 9_999)).rejects.toMatchObject({
      code: 'AMOUNT_OUT_OF_RANGE',
    });
    expect(await WalletFunding.countDocuments({ userId: user._id })).toBe(0);
  });
});

describe('funding confirmation', () => {
  it('credits the wallet only after a verified successful sandbox payment', async () => {
    const user = await createUser();
    const funding = await startFunding(String(user._id));

    expect((await getWallet(String(user._id))).balanceMinor).toBe(0);

    expect(mockGateway().markPaid(funding.reference)).toBe(true);
    const result = await simulateSandboxPayment(String(user._id), funding.reference, 'success');

    expect(result.status).toBe('SUCCESSFUL');
    expect((await getWallet(String(user._id))).balanceMinor).toBe(25_000);

    const stored = await WalletFunding.findOne({ reference: funding.reference }).lean();
    expect(stored?.status).toBe('SUCCESSFUL');
    expect(stored?.paidAt).toBeInstanceOf(Date);
    expect(stored?.creditedAt).toBeInstanceOf(Date);

    const replay = await simulateSandboxPayment(String(user._id), funding.reference, 'success');
    expect(replay.status).toBe('SUCCESSFUL');
    expect((await getWallet(String(user._id))).balanceMinor).toBe(25_000);
    expect(await LedgerEntry.countDocuments({ userId: user._id })).toBe(1);
  });

  it('does not credit the wallet for a failed sandbox payment', async () => {
    const user = await createUser();
    const funding = await startFunding(String(user._id));

    expect(mockGateway().markFailed(funding.reference)).toBe(true);
    const result = await simulateSandboxPayment(String(user._id), funding.reference, 'failed');

    expect(result.status).toBe('FAILED');
    expect((await getWallet(String(user._id))).balanceMinor).toBe(0);
    expect(await LedgerEntry.countDocuments({ userId: user._id })).toBe(0);

    const stored = await WalletFunding.findOne({ reference: funding.reference }).lean();
    expect(stored?.status).toBe('FAILED');
    expect(stored?.failureReason).toContain('failed');
  });

  it('quarantines payments whose verified amount or currency does not match', async () => {
    const user = await createUser();
    const reference = uniqueReference('FUND');
    const funding = await WalletFunding.create({
      reference,
      userId: user._id,
      amountMinor: 25_000,
      status: 'PENDING',
      gateway: 'mock',
      idempotencyKey: uniqueReference('funding'),
      requestHash: 'test-hash',
      isSandbox: true,
    });

    const result = await confirmFunding(
      reference,
      {
        outcome: 'SUCCESSFUL',
        amountMinor: 20_000,
        currency: 'NGN',
        gatewayReference: reference,
        paidAt: new Date(),
      },
      'webhook'
    );

    expect(result.status).toBe('REQUIRES_REVIEW');
    expect((await getWallet(String(user._id))).balanceMinor).toBe(0);
    expect(await LedgerEntry.countDocuments({ userId: user._id })).toBe(0);

    const stored = await WalletFunding.findById(funding._id).lean();
    expect(stored?.status).toBe('REQUIRES_REVIEW');
    expect(stored?.reviewReason).toContain('Gateway mismatch');
  });

  it('accepts a matching verified payment and rejects a replay at the ledger level', async () => {
    const user = await createUser();
    const reference = uniqueReference('FUND');
    await WalletFunding.create({
      reference,
      userId: user._id,
      amountMinor: 15_000,
      status: 'PENDING',
      gateway: 'mock',
      idempotencyKey: uniqueReference('funding'),
      requestHash: 'test-hash',
      isSandbox: true,
    });

    const verification = {
      outcome: 'SUCCESSFUL' as const,
      amountMinor: 15_000,
      currency: 'NGN',
      gatewayReference: reference,
      paidAt: new Date(),
    };

    const first = await confirmFunding(reference, verification, 'callback');
    const second = await confirmFunding(reference, verification, 'callback');

    expect(first.status).toBe('SUCCESSFUL');
    expect(first.alreadyProcessed).toBe(false);
    expect(second.status).toBe('SUCCESSFUL');
    expect(second.alreadyProcessed).toBe(true);
    expect((await getWallet(String(user._id))).balanceMinor).toBe(15_000);
    expect(await LedgerEntry.countDocuments({ userId: user._id })).toBe(1);
  });
});

describe('manual bank funding', () => {
  async function enableManualFunding() {
    await updateSetting(
      'manualFunding',
      {
        enabled: true,
        bankName: 'Example Bank',
        accountName: 'SubPlug Limited',
        accountNumber: '0123456789',
      },
      undefined
    );
  }

  it('records submitted transfer details without crediting the wallet', async () => {
    await enableManualFunding();
    const user = await createUser();
    const input = {
      userId: String(user._id),
      amountMinor: 25_000,
      senderName: 'Customer Name',
      senderBank: 'Customer Bank',
      transferReference: 'TRF-123456789',
      idempotencyKey: uniqueReference('manual-fund'),
      req: fakeReq,
    };

    const result = await createManualFundingRequest(input);
    const stored = await WalletFunding.findOne({ reference: result.reference }).lean();

    expect(result).toMatchObject({ status: 'PENDING', duplicate: false });
    expect(stored).toMatchObject({
      gateway: 'manual',
      gatewayReference: 'TRF-123456789',
      gatewayPayload: { senderName: 'Customer Name', senderBank: 'Customer Bank' },
    });
    expect((await getWallet(String(user._id))).balanceMinor).toBe(0);
  });

  it('keeps receiving account details out of public settings', async () => {
    await enableManualFunding();

    const [publicSettings, manualFunding] = await Promise.all([getPublicSettings(), getManualFundingSettings()]);

    expect(publicSettings).not.toHaveProperty('manualFunding');
    expect(manualFunding).toMatchObject({
      enabled: true,
      bankName: 'Example Bank',
      accountName: 'SubPlug Limited',
      accountNumber: '0123456789',
    });
  });

  it('credits a manual transfer only after administrator approval, once', async () => {
    await enableManualFunding();
    const user = await createUser();
    const result = await createManualFundingRequest({
      userId: String(user._id),
      amountMinor: 25_000,
      senderName: 'Customer Name',
      senderBank: 'Customer Bank',
      transferReference: 'TRF-987654321',
      idempotencyKey: uniqueReference('manual-fund'),
      req: fakeReq,
    });

    const actor = { id: String(user._id), name: 'Administrator', role: 'ADMIN' };
    const first = await approveManualFunding(actor, result.reference, fakeReq);
    const second = await approveManualFunding(actor, result.reference, fakeReq);

    expect(first.status).toBe('SUCCESSFUL');
    expect(second).toMatchObject({ status: 'SUCCESSFUL', alreadyProcessed: true });
    expect((await WalletFunding.findOne({ reference: result.reference }).lean())?.gatewayReference).toBe(
      'TRF-987654321'
    );
    expect((await getWallet(String(user._id))).balanceMinor).toBe(25_000);
    expect(await LedgerEntry.countDocuments({ userId: user._id, type: 'FUNDING_CREDIT' })).toBe(1);
  });
});

describe('payment webhooks', () => {
  async function signedBody(payload: Record<string, unknown>) {
    const body = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha512', env.JWT_ACCESS_SECRET).update(body).digest('hex');
    return { body, signature };
  }

  it('rejects webhooks with an invalid signature and does not credit the wallet', async () => {
    const user = await createUser();
    const funding = await startFunding(String(user._id));
    mockGateway().markPaid(funding.reference);

    const { body } = await signedBody({
      event: 'charge.success',
      eventId: uniqueReference('evt'),
      reference: funding.reference,
    });

    await expect(handlePaymentWebhook('mock', body, 'invalid-signature')).rejects.toMatchObject({
      code: 'INVALID_SIGNATURE',
    });

    expect(await PaymentEvent.countDocuments()).toBe(0);
    expect((await getWallet(String(user._id))).balanceMinor).toBe(0);
    expect((await WalletFunding.findOne({ reference: funding.reference }).lean())?.status).toBe(
      'PENDING'
    );
  });

  it('processes a signed charge.success event once and ignores duplicate deliveries', async () => {
    const user = await createUser();
    const funding = await startFunding(String(user._id));
    mockGateway().markPaid(funding.reference);

    const eventId = uniqueReference('evt');
    const { body, signature } = await signedBody({
      event: 'charge.success',
      eventId,
      reference: funding.reference,
    });

    const first = await handlePaymentWebhook('mock', body, signature);
    expect(first.received).toBe(true);
    expect(first).toMatchObject({ result: { status: 'SUCCESSFUL' } });
    expect((await getWallet(String(user._id))).balanceMinor).toBe(25_000);

    const duplicate = await handlePaymentWebhook('mock', body, signature);
    expect(duplicate).toMatchObject({ received: true, duplicate: true });
    expect((await getWallet(String(user._id))).balanceMinor).toBe(25_000);
    expect(await PaymentEvent.countDocuments({ eventId })).toBe(1);
  });

  it('acknowledges but ignores unrelated signed event types', async () => {
    const { body, signature } = await signedBody({
      event: 'transfer.success',
      eventId: uniqueReference('evt'),
      reference: uniqueReference('FUND'),
    });

    const result = await handlePaymentWebhook('mock', body, signature);

    expect(result).toMatchObject({ received: true, ignored: true });
    expect(await PaymentEvent.countDocuments({ eventType: 'transfer.success' })).toBe(1);
  });

  it('does not let one gateway confirm a funding created by another', async () => {
    const user = await createUser();
    const funding = await startFunding(String(user._id));

    const body = Buffer.from(
      JSON.stringify({
        event: 'charge.completed',
        data: { id: uniqueReference('flw'), tx_ref: funding.reference, status: 'successful' },
      })
    );
    const result = await handlePaymentWebhook('flutterwave', body, env.FLUTTERWAVE_WEBHOOK_SECRET_HASH);

    expect(result).toMatchObject({ received: true, ignored: true });
    expect((await getWallet(String(user._id))).balanceMinor).toBe(0);
    expect((await WalletFunding.findOne({ reference: funding.reference }).lean())?.status).toBe('PENDING');

    const event = await PaymentEvent.findOne({ gateway: 'flutterwave' }).lean();
    expect(event?.processingError).toContain('Gateway mismatch');
  });
});
