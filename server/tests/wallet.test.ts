import { describe, expect, it } from 'vitest';
import { LedgerEntry, Transaction, Wallet } from '../src/models';
import {
  creditWallet,
  debitWallet,
  getWallet,
  reconcileWallets,
  refundTransaction,
} from '../src/services/walletService';
import { AppError } from '../src/utils/AppError';
import { createUser, uniqueReference } from './helpers';

function expectAppError(error: unknown, code: string) {
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  return error as AppError;
}

async function ledgerFor(userId: string) {
  return LedgerEntry.find({ userId }).sort({ createdAt: 1 }).lean();
}

async function createFailedTransaction(userId: string, payableMinor = 5000) {
  return Transaction.create({
    reference: uniqueReference('TXN'),
    userId,
    service: 'AIRTIME',
    amountMinor: payableMinor,
    payableMinor,
    status: 'FAILED',
    statusHistory: [{ status: 'FAILED', at: new Date(), reason: 'Provider declined' }],
    provider: 'mock',
    idempotencyKey: uniqueReference('IDEM'),
    requestHash: 'test-request-hash',
    recipient: { phone: '+2348012345678', network: 'MTN' },
  });
}

describe('wallet ledger', () => {
  it('creates a wallet and records a credit entry with the resulting balance', async () => {
    const user = await createUser();

    const entry = await creditWallet({
      userId: String(user._id),
      amountMinor: 25_000,
      type: 'FUNDING_CREDIT',
      idempotencyKey: uniqueReference('credit'),
      description: 'Test funding credit',
    });

    expect(entry.direction).toBe('CREDIT');
    expect(entry.amountMinor).toBe(25_000);
    expect(entry.balanceAfterMinor).toBe(25_000);
    expect(entry.currency).toBe('NGN');

    const wallet = await getWallet(String(user._id));
    expect(wallet.balanceMinor).toBe(25_000);
    expect(wallet.status).toBe('ACTIVE');

    const entries = await ledgerFor(String(user._id));
    expect(entries).toHaveLength(1);
    expect(entries[0].reference).toMatch(/^CR_/);
    expect(String(entries[0].walletId)).toBe(wallet.id);
  });

  it('returns the original entry when the same idempotency key is replayed', async () => {
    const user = await createUser();
    const key = uniqueReference('same-key');

    const first = await creditWallet({
      userId: String(user._id),
      amountMinor: 10_000,
      type: 'FUNDING_CREDIT',
      idempotencyKey: key,
      description: 'First credit',
    });
    const second = await creditWallet({
      userId: String(user._id),
      amountMinor: 10_000,
      type: 'FUNDING_CREDIT',
      idempotencyKey: key,
      description: 'Replayed credit',
    });

    expect(String(second._id)).toBe(String(first._id));
    expect(second.description).toBe('First credit');
    expect((await getWallet(String(user._id))).balanceMinor).toBe(10_000);
    expect(await LedgerEntry.countDocuments({ userId: user._id })).toBe(1);
  });

  it('rejects idempotency-key reuse with different financial details', async () => {
    const user = await createUser();
    const key = uniqueReference('mismatch');

    await creditWallet({
      userId: String(user._id),
      amountMinor: 10_000,
      type: 'FUNDING_CREDIT',
      idempotencyKey: key,
      description: 'Original credit',
    });

    await expect(
      creditWallet({
        userId: String(user._id),
        amountMinor: 20_000,
        type: 'FUNDING_CREDIT',
        idempotencyKey: key,
        description: 'Changed amount',
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_MISMATCH' });

    await expect(
      debitWallet({
        userId: String(user._id),
        amountMinor: 10_000,
        type: 'FUNDING_CREDIT',
        idempotencyKey: key,
        description: 'Changed direction',
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_MISMATCH' });

    expect((await getWallet(String(user._id))).balanceMinor).toBe(10_000);
  });

  it('debits the wallet and records a debit entry', async () => {
    const user = await createUser();
    await creditWallet({
      userId: String(user._id),
      amountMinor: 50_000,
      type: 'FUNDING_CREDIT',
      idempotencyKey: uniqueReference('credit'),
      description: 'Opening credit',
    });

    const debit = await debitWallet({
      userId: String(user._id),
      amountMinor: 12_500,
      type: 'PURCHASE_DEBIT',
      idempotencyKey: uniqueReference('debit'),
      description: 'Test purchase',
    });

    expect(debit.direction).toBe('DEBIT');
    expect(debit.balanceAfterMinor).toBe(37_500);
    expect((await getWallet(String(user._id))).balanceMinor).toBe(37_500);
  });

  it('refuses a debit that would overdraw the wallet and leaves no ledger entry', async () => {
    const user = await createUser();
    await creditWallet({
      userId: String(user._id),
      amountMinor: 3_000,
      type: 'FUNDING_CREDIT',
      idempotencyKey: uniqueReference('credit'),
      description: 'Opening credit',
    });

    try {
      await debitWallet({
        userId: String(user._id),
        amountMinor: 3_001,
        type: 'PURCHASE_DEBIT',
        idempotencyKey: uniqueReference('overdraw'),
        description: 'Too large',
      });
      throw new Error('Expected the debit to fail');
    } catch (error) {
      const appError = expectAppError(error, 'INSUFFICIENT_BALANCE');
      expect(appError.statusCode).toBe(402);
    }

    expect((await getWallet(String(user._id))).balanceMinor).toBe(3_000);
    expect(await LedgerEntry.countDocuments({ userId: user._id, direction: 'DEBIT' })).toBe(0);
  });

  it('serializes concurrent debits so the balance can never go negative', async () => {
    const user = await createUser();
    const userId = String(user._id);
    await creditWallet({
      userId,
      amountMinor: 5_000,
      type: 'FUNDING_CREDIT',
      idempotencyKey: uniqueReference('credit'),
      description: 'Opening credit',
    });

    const attempts = Array.from({ length: 10 }, () =>
      debitWallet({
        userId,
        amountMinor: 1_000,
        type: 'PURCHASE_DEBIT',
        idempotencyKey: uniqueReference('concurrent'),
        description: 'Concurrent debit',
      }).then(
        () => 'ok' as const,
        (error: unknown) => (error instanceof AppError ? error.code : 'unexpected')
      )
    );

    const outcomes = await Promise.all(attempts);
    expect(outcomes.filter((o) => o === 'ok')).toHaveLength(5);
    expect(outcomes.filter((o) => o === 'INSUFFICIENT_BALANCE')).toHaveLength(5);
    expect(outcomes).not.toContain('unexpected');

    const wallet = await getWallet(userId);
    expect(wallet.balanceMinor).toBe(0);

    const entries = await ledgerFor(userId);
    expect(entries.filter((e) => e.direction === 'DEBIT')).toHaveLength(5);
    const net = entries.reduce(
      (sum, entry) => sum + (entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor),
      0
    );
    expect(net).toBe(0);
  });

  it('rejects debits from a frozen wallet', async () => {
    const user = await createUser();
    const userId = String(user._id);
    await creditWallet({
      userId,
      amountMinor: 10_000,
      type: 'FUNDING_CREDIT',
      idempotencyKey: uniqueReference('credit'),
      description: 'Opening credit',
    });
    await Wallet.updateOne({ userId: user._id }, { $set: { status: 'FROZEN' } });

    await expect(
      debitWallet({
        userId,
        amountMinor: 1_000,
        type: 'PURCHASE_DEBIT',
        idempotencyKey: uniqueReference('frozen'),
        description: 'Frozen wallet debit',
      })
    ).rejects.toMatchObject({ code: 'WALLET_FROZEN' });

    expect((await getWallet(userId)).balanceMinor).toBe(10_000);
  });

  it('rejects zero, negative, and fractional minor-unit amounts', async () => {
    const user = await createUser();
    const userId = String(user._id);

    for (const amountMinor of [0, -100, 10.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(
        creditWallet({
          userId,
          amountMinor,
          type: 'FUNDING_CREDIT',
          idempotencyKey: uniqueReference('invalid'),
          description: 'Invalid amount',
        })
      ).rejects.toThrow(/positive integer/);
    }

    expect(await LedgerEntry.countDocuments({ userId: user._id })).toBe(0);
  });

  it('keeps ledger entries immutable', async () => {
    const user = await createUser();
    const entry = await creditWallet({
      userId: String(user._id),
      amountMinor: 1_000,
      type: 'FUNDING_CREDIT',
      idempotencyKey: uniqueReference('immutable'),
      description: 'Immutable entry',
    });

    await expect(
      LedgerEntry.updateOne({ _id: entry._id }, { $set: { amountMinor: 1_000_000 } })
    ).rejects.toThrow('Ledger entries are immutable');
    await expect(
      LedgerEntry.findOneAndUpdate({ _id: entry._id }, { $set: { amountMinor: 1_000_000 } })
    ).rejects.toThrow('Ledger entries are immutable');
    await expect(LedgerEntry.deleteOne({ _id: entry._id })).rejects.toThrow(
      'Ledger entries are immutable'
    );
    await expect(LedgerEntry.deleteMany({})).rejects.toThrow('Ledger entries are immutable');

    const unchanged = await LedgerEntry.findById(entry._id).lean();
    expect(unchanged?.amountMinor).toBe(1_000);
  });

  it('detects wallet/ledger drift without mutating either record', async () => {
    const user = await createUser();
    const userId = String(user._id);
    await creditWallet({
      userId,
      amountMinor: 7_500,
      type: 'FUNDING_CREDIT',
      idempotencyKey: uniqueReference('reconcile'),
      description: 'Opening credit',
    });

    const clean = await reconcileWallets(200);
    expect(clean.discrepancies).toHaveLength(0);

    await Wallet.updateOne({ userId: user._id }, { $set: { balanceMinor: 9_000 } });
    const drifted = await reconcileWallets(200);
    expect(drifted.discrepancies).toHaveLength(1);
    expect(drifted.discrepancies[0]).toMatchObject({
      userId,
      ledgerBalanceMinor: 7_500,
      storedBalanceMinor: 9_000,
      differenceMinor: 1_500,
    });

    const wallet = await Wallet.findOne({ userId: user._id }).lean();
    expect(wallet?.balanceMinor).toBe(9_000);
    expect(await LedgerEntry.countDocuments({ userId: user._id })).toBe(1);
  });
});

describe('transaction refunds', () => {
  it('credits a failed transaction exactly once and marks it refunded', async () => {
    const user = await createUser();
    const userId = String(user._id);
    const transaction = await createFailedTransaction(userId, 4_200);

    await refundTransaction(String(transaction._id), 'Provider declined');
    await refundTransaction(String(transaction._id), 'Replayed refund');

    expect((await getWallet(userId)).balanceMinor).toBe(4_200);

    const refunds = await LedgerEntry.find({ userId: user._id, type: 'REFUND' }).lean();
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amountMinor).toBe(4_200);
    expect(refunds[0].idempotencyKey).toBe(`refund:${String(transaction._id)}`);
    expect(String(refunds[0].transactionId)).toBe(String(transaction._id));

    const updated = await Transaction.findById(transaction._id).lean();
    expect(updated?.status).toBe('REFUNDED');
    expect(updated?.refundedAt).toBeTruthy();
    expect(updated?.refundedAmountMinor).toBe(4_200);
  });

  it('is safe under concurrent refund attempts', async () => {
    const user = await createUser();
    const userId = String(user._id);
    const transaction = await createFailedTransaction(userId, 3_333);

    await Promise.allSettled(
      Array.from({ length: 5 }, () => refundTransaction(String(transaction._id), 'Concurrent refund'))
    );

    expect((await getWallet(userId)).balanceMinor).toBe(3_333);
    expect(await LedgerEntry.countDocuments({ userId: user._id, type: 'REFUND' })).toBe(1);
  });

  it('refuses to refund transactions that did not fail', async () => {
    const user = await createUser();
    const transaction = await Transaction.create({
      reference: uniqueReference('TXN'),
      userId: user._id,
      service: 'DATA',
      amountMinor: 10_000,
      payableMinor: 10_000,
      status: 'SUCCESSFUL',
      statusHistory: [{ status: 'SUCCESSFUL', at: new Date() }],
      provider: 'mock',
      idempotencyKey: uniqueReference('IDEM'),
      requestHash: 'test-request-hash',
    });

    await expect(
      refundTransaction(String(transaction._id), 'Not allowed')
    ).rejects.toMatchObject({ code: 'REFUND_NOT_ALLOWED' });

    expect((await getWallet(String(user._id))).balanceMinor).toBe(0);
    expect(await LedgerEntry.countDocuments({ userId: user._id })).toBe(0);
    expect((await Transaction.findById(transaction._id).lean())?.status).toBe('SUCCESSFUL');
  });

  it('returns not found for an unknown transaction', async () => {
    await expect(refundTransaction('507f1f77bcf86cd799439011', 'Missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
