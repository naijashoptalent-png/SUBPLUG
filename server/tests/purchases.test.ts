import { afterEach, describe, expect, it } from 'vitest';
import { LedgerEntry, ServicePlan, Transaction, Wallet } from '../src/models';
import { getVtuProvider, setVtuProviderForTests } from '../src/providers';
import { MockVtuProvider } from '../src/providers/mockVtuProvider';
import {
  cleanDataPlanName,
  effectiveAirtimeDiscountPercent,
  normaliseDataPlanCategory,
} from '../src/services/catalogueService';
import { getTransaction, purchaseAirtime, purchaseElectricity } from '../src/services/purchaseService';
import { creditWallet } from '../src/services/walletService';
import { createUser, uniqueReference } from './helpers';

const actorFor = (user: { _id: unknown; role: string }) => ({
  userId: String(user._id),
  role: user.role,
});

async function fundedUser(amountMinor = 20_000) {
  const user = await createUser();
  await creditWallet({
    userId: String(user._id),
    amountMinor,
    type: 'FUNDING_CREDIT',
    idempotencyKey: uniqueReference('funding'),
    description: 'Test wallet funding',
  });
  return user;
}

async function balanceOf(userId: string) {
  const wallet = await Wallet.findOne({ userId }).lean();
  return wallet?.balanceMinor ?? 0;
}

function airtimeInput(phone: string, amountMinor = 10_000, idempotencyKey = uniqueReference('air')) {
  return { network: 'MTN', phone, amountMinor, idempotencyKey };
}

afterEach(() => {
  setVtuProviderForTests(null);
});

describe('data plan categories', () => {
  it('maps provider families to customer-facing categories without provider branding', () => {
    expect(normaliseDataPlanCategory('SME')).toEqual({ code: 'STANDARD', label: 'Standard' });
    expect(normaliseDataPlanCategory('SME2').code).toBe('STANDARD');
    expect(normaliseDataPlanCategory('Corporate').label).toBe('Corporate');
    expect(normaliseDataPlanCategory('Corporate2').code).toBe('CORPORATE');
    expect(normaliseDataPlanCategory('Gifting').label).toBe('Gifting');
    expect(normaliseDataPlanCategory('Coupon').label).toBe('Coupon');
    expect(normaliseDataPlanCategory('Share').label).toBe('Share');
    expect(normaliseDataPlanCategory('unexpected-family').label).toBe('Other');
  });

  it('strips legacy provider-family suffixes from plan names', () => {
    expect(cleanDataPlanName('500MB \u00B7 SME')).toBe('500MB');
    expect(cleanDataPlanName('1GB \u00B7 Corporate2')).toBe('1GB');
    expect(cleanDataPlanName('1GB')).toBe('1GB');
  });
});

describe('airtime pricing', () => {
  it('only applies configured discounts in sandbox mode', () => {
    expect(effectiveAirtimeDiscountPercent(true, 2)).toBe(2);
    expect(effectiveAirtimeDiscountPercent(false, 2)).toBe(0);
  });
});

describe('airtime purchases', () => {
  it('debits the discounted price, records a successful transaction, and is idempotent', async () => {
    const user = await fundedUser(20_000);
    const input = airtimeInput('08012345678');

    const purchase = await purchaseAirtime(actorFor(user), input);

    // Default MTN airtime discount is 2%: 10,000 kobo face value costs 9,800.
    expect(purchase.payableMinor).toBe(9_800);
    expect(purchase.discountMinor).toBe(200);
    expect(purchase.status).toBe('SUCCESSFUL');
    expect(purchase.isSandbox).toBe(true);
    expect(purchase.provider).toBeUndefined();
    expect(purchase.providerReference).toBeUndefined();
    expect(purchase.recipient.phone).toBe('+2348012345678');
    expect(await balanceOf(String(user._id))).toBe(10_200);

    const statuses = purchase.statusHistory.map((entry: { status: string }) => entry.status);
    expect(statuses).toEqual(['CREATED', 'PENDING', 'PROCESSING', 'SUCCESSFUL']);

    const replay = await purchaseAirtime(actorFor(user), input);
    expect(replay.duplicate).toBe(true);
    expect(replay.reference).toBe(purchase.reference);
    expect(await balanceOf(String(user._id))).toBe(10_200);
    expect(await LedgerEntry.countDocuments({ userId: user._id, type: 'PURCHASE_DEBIT' })).toBe(1);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(1);
  });

  it('rejects reuse of an idempotency key for a different recipient', async () => {
    const user = await fundedUser(20_000);
    const input = airtimeInput('08012345678');

    await purchaseAirtime(actorFor(user), input);

    await expect(
      purchaseAirtime(actorFor(user), { ...input, phone: '08098765432' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_MISMATCH' });

    expect(await balanceOf(String(user._id))).toBe(10_200);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(1);
  });

  it('refunds the wallet automatically when the provider definitively fails', async () => {
    const user = await fundedUser(20_000);

    const purchase = await purchaseAirtime(actorFor(user), airtimeInput('08012340000'));

    expect(purchase.status).toBe('REFUNDED');
    expect(purchase.providerStatus).toBeNull();
    expect(purchase.provider).toBeUndefined();
    expect(purchase.providerReference).toBeUndefined();
    expect(purchase.failureReason).toContain('Sandbox deterministic failure');
    expect(purchase.refundedAmountMinor).toBe(9_800);
    expect(purchase.refundedAt).toBeTruthy();
    expect(await balanceOf(String(user._id))).toBe(20_000);

    const stored = await Transaction.findById(purchase.id).lean();
    expect(stored?.providerStatus).toBe('FAILED');

    const entries = await LedgerEntry.find({ userId: user._id }).lean();
    expect(entries).toHaveLength(3); // funding credit, purchase debit, refund
    const refund = entries.find((entry) => entry.type === 'REFUND');
    expect(refund?.amountMinor).toBe(9_800);
    expect(String(refund?.transactionId)).toBe(purchase.id);
    expect(entries.reduce((sum, e) => sum + (e.direction === 'CREDIT' ? e.amountMinor : -e.amountMinor), 0)).toBe(
      20_000
    );
  });

  it('keeps funds reserved while a provider result is pending', async () => {
    const user = await fundedUser(20_000);

    const purchase = await purchaseAirtime(actorFor(user), airtimeInput('08012341111'));

    expect(purchase.status).toBe('PROCESSING');
    expect(purchase.providerStatus).toBeNull();
    expect(purchase.failureReason).toBeFalsy();
    expect(purchase.refundedAt).toBeFalsy();
    expect(await balanceOf(String(user._id))).toBe(10_200);

    const stored = await Transaction.findById(purchase.id).lean();
    expect(stored?.providerStatus).toBe('PENDING');
    expect(stored?.nextReconcileAt).toBeInstanceOf(Date);
  });

  it('moves uncertain provider outcomes to manual review without retrying or refunding', async () => {
    const user = await fundedUser(20_000);

    const purchase = await purchaseAirtime(actorFor(user), airtimeInput('08012342222'));

    expect(purchase.status).toBe('REQUIRES_REVIEW');
    expect(purchase.providerStatus).toBeNull();
    expect(purchase.reviewReason).toContain('uncertain');
    expect(purchase.refundedAt).toBeFalsy();
    expect(await balanceOf(String(user._id))).toBe(10_200);

    const stored = await Transaction.findById(purchase.id).lean();
    expect(stored?.providerStatus).toBe('UNCERTAIN');
    expect(await LedgerEntry.countDocuments({ userId: user._id, type: 'REFUND' })).toBe(0);
  });
});

describe('customer transaction privacy', () => {
  it('omits provider identity, provider status and operational timeline notes from customer views', async () => {
    const user = await createUser();
    const transaction = await Transaction.create({
      reference: uniqueReference('privacy'),
      userId: user._id,
      service: 'AIRTIME',
      amountMinor: 10_000,
      payableMinor: 10_000,
      feeMinor: 0,
      discountMinor: 0,
      costMinor: 9_800,
      marginMinor: 200,
      currency: 'NGN',
      status: 'FAILED',
      statusHistory: [
        { status: 'FAILED', at: new Date(), reason: 'MaskawaSub returned no purchase response' },
      ],
      provider: 'maskawasub',
      providerReference: 'PROVIDER-REF-123',
      providerStatus: 'REQUEST_FAILED',
      failureReason: 'MaskawaSub returned no purchase response',
      recipient: { phone: '+2348012345678', network: 'MTN' },
      idempotencyKey: uniqueReference('privacy-idem'),
      requestHash: 'privacy-test-hash',
      paymentMethod: 'WALLET',
      metadata: { isSandbox: false },
    });

    const customerView = await getTransaction(actorFor(user), transaction.reference);
    expect(customerView.provider).toBeUndefined();
    expect(customerView.providerReference).toBeUndefined();
    expect(customerView.providerStatus).toBeNull();
    expect(customerView.failureReason).toBe(
      'The purchase could not be completed. Please contact support with your reference.'
    );
    expect(customerView.statusHistory.every((event) => !event.note)).toBe(true);

    const adminView = await getTransaction(
      { userId: String(user._id), role: 'ADMIN' },
      transaction.reference
    );
    expect(adminView.provider).toBe('maskawasub');
    expect(adminView.providerReference).toBe('PROVIDER-REF-123');
    expect(adminView.providerStatus).toBe('REQUEST_FAILED');
    expect(adminView.failureReason).toContain('MaskawaSub');
    expect(adminView.statusHistory[0]?.note).toContain('MaskawaSub');
  });
});

describe('bill payment validation', () => {
  async function createDisco() {
    return ServicePlan.create({
      provider: 'mock',
      service: 'ELECTRICITY',
      network: 'IKEDC',
      providerPlanId: 'IKEDC',
      name: 'Ikeja Electric (IKEDC)',
      costMinor: 0,
      sellingPriceMinor: 100,
      enabled: true,
      isSandbox: true,
      metadata: { kind: 'DISCO' },
    });
  }

  it('does not debit the wallet or contact the provider when meter validation fails', async () => {
    await createDisco();
    const user = await fundedUser(100_000);

    class RejectingMeterProvider extends MockVtuProvider {
      purchaseCalls = 0;

      override async validateMeter() {
        return { valid: false, isSandbox: true, message: 'Meter could not be validated' };
      }

      override async purchase(request: Parameters<MockVtuProvider['purchase']>[0]) {
        this.purchaseCalls += 1;
        return super.purchase(request);
      }
    }

    const provider = new RejectingMeterProvider();
    setVtuProviderForTests(provider);

    await expect(
      purchaseElectricity(actorFor(user), {
        disco: 'IKEDC',
        meterNumber: '1234567890',
        meterType: 'PREPAID',
        amountMinor: 50_000,
        idempotencyKey: uniqueReference('meter'),
      })
    ).rejects.toMatchObject({ code: 'INVALID_METER' });

    expect(provider.purchaseCalls).toBe(0);
    expect(await balanceOf(String(user._id))).toBe(100_000);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(0);
  });

  it('pays electricity after validation and stores the sandbox token', async () => {
    await createDisco();
    const user = await fundedUser(100_000);
    expect(getVtuProvider().isSandbox).toBe(true);

    const purchase = await purchaseElectricity(actorFor(user), {
      disco: 'IKEDC',
      meterNumber: '1234567890',
      meterType: 'PREPAID',
      amountMinor: 50_000,
      idempotencyKey: uniqueReference('power'),
    });

    expect(purchase.status).toBe('SUCCESSFUL');
    expect(purchase.payableMinor).toBe(50_000);
    expect(purchase.fulfillment.token).toMatch(/^SANDBOX-/);
    expect(purchase.fulfillment.customerName).toContain('SANDBOX');
    expect(await balanceOf(String(user._id))).toBe(50_000);
  });
});
