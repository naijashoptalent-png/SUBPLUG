import { ClientSession, FilterQuery, HydratedDocument, Types } from 'mongoose';
import { ILedgerEntry } from '../models/LedgerEntry';
import { Wallet, LedgerEntry, Transaction } from '../models';
import { AppError } from '../utils/AppError';
import { generateReference } from '../utils/reference';
import { assertPositiveMinor } from '../utils/money';
import { runInTransaction } from '../utils/transactionRunner';
import { LedgerType } from '../config/constants';
import { logger } from '../config/logger';
import { paginationMeta } from '../utils/pagination';

interface LedgerInput {
  userId: string;
  amountMinor: number;
  type: LedgerType;
  idempotencyKey: string;
  description: string;
  transactionId?: string;
  fundingId?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  /** Join an existing MongoDB transaction when one is active. */
  session?: ClientSession;
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: number }).code === 11000);
}

async function ensureWallet(userId: string): Promise<void> {
  await Wallet.updateOne(
    { userId },
    { $setOnInsert: { userId, balanceMinor: 0, status: 'ACTIVE' } },
    { upsert: true }
  );
}

export async function getWallet(userId: string) {
  await ensureWallet(userId);
  const wallet = await Wallet.findOne({ userId }).lean();
  if (!wallet) throw AppError.notFound('Wallet not found');
  return {
    id: String(wallet._id),
    balanceMinor: wallet.balanceMinor,
    currency: wallet.currency,
    status: wallet.status,
    updatedAt: wallet.updatedAt,
  };
}

export async function getWalletOverview(userId: string, days = 30) {
  const wallet = await getWallet(userId);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [totals, recent] = await Promise.all([
    LedgerEntry.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          credits: { $sum: { $cond: [{ $eq: ['$direction', 'CREDIT'] }, '$amountMinor', 0] } },
          debits: { $sum: { $cond: [{ $eq: ['$direction', 'DEBIT'] }, '$amountMinor', 0] } },
        },
      },
    ]),
    LedgerEntry.aggregate([
      { $match: { userId: new Types.ObjectId(userId), createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          credits: { $sum: { $cond: [{ $eq: ['$direction', 'CREDIT'] }, '$amountMinor', 0] } },
          debits: { $sum: { $cond: [{ $eq: ['$direction', 'DEBIT'] }, '$amountMinor', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    wallet,
    lifetimeCreditsMinor: totals[0]?.credits ?? 0,
    lifetimeDebitsMinor: totals[0]?.debits ?? 0,
    activity: recent.map((r) => ({ date: r._id, creditsMinor: r.credits, debitsMinor: r.debits })),
  };
}

export async function listLedger(
  userId: string,
  options: { page: number; limit: number; type?: string; direction?: string }
) {
  const filter: FilterQuery<unknown> = { userId };
  if (options.type) filter.type = options.type;
  if (options.direction) filter.direction = options.direction;
  const [entries, total] = await Promise.all([
    LedgerEntry.find(filter)
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate('transactionId', 'reference service status')
      .lean(),
    LedgerEntry.countDocuments(filter),
  ]);
  return {
    entries: entries.map((entry) => ({
      id: String(entry._id),
      type: entry.type,
      direction: entry.direction,
      amountMinor: entry.amountMinor,
      balanceAfterMinor: entry.balanceAfterMinor,
      currency: entry.currency,
      reference: entry.reference,
      description: entry.description,
      transaction: entry.transactionId,
      fundingId: entry.fundingId,
      createdAt: entry.createdAt,
    })),
    pagination: paginationMeta(total, options.page, options.limit),
  };
}

async function postLedgerCore(
  input: LedgerInput,
  direction: 'CREDIT' | 'DEBIT',
  session?: ClientSession
): Promise<HydratedDocument<ILedgerEntry>> {
  const existing = await LedgerEntry.findOne({ idempotencyKey: input.idempotencyKey }).session(session ?? null);
  if (existing) {
    if (
      String(existing.userId) !== input.userId ||
      existing.amountMinor !== input.amountMinor ||
      existing.type !== input.type ||
      existing.direction !== direction
    ) {
      throw AppError.conflict('Idempotency key was reused with different financial details', 'IDEMPOTENCY_MISMATCH');
    }
    return existing;
  }

  await Wallet.updateOne(
    { userId: input.userId },
    { $setOnInsert: { userId: input.userId, balanceMinor: 0, status: 'ACTIVE' } },
    { upsert: true, ...(session ? { session } : {}) }
  );

  const filter: FilterQuery<unknown> = { userId: input.userId, status: 'ACTIVE' };
  if (direction === 'DEBIT') filter.balanceMinor = { $gte: input.amountMinor };

  const wallet = await Wallet.findOneAndUpdate(
    filter,
    { $inc: { balanceMinor: direction === 'CREDIT' ? input.amountMinor : -input.amountMinor } },
    { new: true, ...(session ? { session } : {}) }
  );

  if (!wallet) {
    const existingWallet = await Wallet.findOne({ userId: input.userId }).session(session ?? null);
    if (!existingWallet) throw AppError.notFound('Wallet not found');
    if (existingWallet.status !== 'ACTIVE') {
      throw AppError.forbidden('Your wallet is frozen. Contact support.', 'WALLET_FROZEN');
    }
    throw new AppError(402, 'INSUFFICIENT_BALANCE', 'Insufficient wallet balance');
  }

  const reference = generateReference(direction === 'CREDIT' ? 'CR' : 'DR');
  const [entry] = await LedgerEntry.create(
    [
      {
        walletId: wallet._id,
        userId: input.userId,
        type: input.type,
        direction,
        amountMinor: input.amountMinor,
        balanceAfterMinor: wallet.balanceMinor,
        reference,
        idempotencyKey: input.idempotencyKey,
        description: input.description,
        transactionId: input.transactionId ?? null,
        fundingId: input.fundingId ?? null,
        createdBy: input.createdBy ?? null,
        metadata: input.metadata ?? {},
      },
    ],
    session ? { session } : {}
  );

  return entry;
}

async function postLedger(
  input: LedgerInput,
  direction: 'CREDIT' | 'DEBIT'
): Promise<HydratedDocument<ILedgerEntry>> {
  assertPositiveMinor(input.amountMinor);

  if (input.session) {
    return postLedgerCore(input, direction, input.session);
  }

  return runInTransaction(
    async (session) => postLedgerCore(input, direction, session),
    `wallet:${input.userId}`
  ).catch(async (error) => {
    if (isDuplicateKey(error)) {
      const existing = await LedgerEntry.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) return existing;
    }
    throw error;
  });
}

export async function creditWallet(input: LedgerInput) {
  return postLedger(input, 'CREDIT');
}

export async function debitWallet(input: LedgerInput) {
  return postLedger(input, 'DEBIT');
}

export async function refundTransaction(transactionId: string, reason: string): Promise<void> {
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) throw AppError.notFound('Transaction not found');
  if (transaction.refundedAt) return; // refund already recorded — idempotent no-op
  if (transaction.status !== 'FAILED') {
    throw AppError.conflict('Only confirmed failed transactions can be refunded', 'REFUND_NOT_ALLOWED');
  }

  await creditWallet({
    userId: String(transaction.userId),
    amountMinor: transaction.payableMinor,
    type: 'REFUND',
    idempotencyKey: `refund:${String(transaction._id)}`,
    description: `Refund for ${transaction.reference}`,
    transactionId: String(transaction._id),
    metadata: { reason },
  });

  await Transaction.updateOne(
    { _id: transaction._id, refundedAt: null },
    {
      $set: { refundedAt: new Date(), refundedAmountMinor: transaction.payableMinor, status: 'REFUNDED' },
      $push: { statusHistory: { status: 'REFUNDED', at: new Date(), reason } },
    }
  );
}

/**
 * Detects drift between wallet balance projections and the immutable ledger.
 * This tool never mutates data; corrections require a separate authorized
 * adjustment with an audit trail.
 */
export async function reconcileWallets(limit = 100) {
  const wallets = await Wallet.find().limit(limit).lean();
  const discrepancies: Array<Record<string, unknown>> = [];

  for (const wallet of wallets) {
    const totals = await LedgerEntry.aggregate([
      { $match: { walletId: wallet._id } },
      {
        $group: {
          _id: null,
          credits: { $sum: { $cond: [{ $eq: ['$direction', 'CREDIT'] }, '$amountMinor', 0] } },
          debits: { $sum: { $cond: [{ $eq: ['$direction', 'DEBIT'] }, '$amountMinor', 0] } },
        },
      },
    ]);
    const ledgerBalance = (totals[0]?.credits ?? 0) - (totals[0]?.debits ?? 0);
    if (ledgerBalance !== wallet.balanceMinor) {
      discrepancies.push({
        walletId: String(wallet._id),
        userId: String(wallet.userId),
        ledgerBalanceMinor: ledgerBalance,
        storedBalanceMinor: wallet.balanceMinor,
        differenceMinor: wallet.balanceMinor - ledgerBalance,
      });
      logger.error(
        { walletId: String(wallet._id), ledgerBalance, storedBalance: wallet.balanceMinor },
        'Wallet/ledger discrepancy detected'
      );
    }
  }

  return { checked: wallets.length, discrepancies };
}

export async function adminAdjustWallet(input: {
  userId: string;
  amountMinor: number;
  direction: 'CREDIT' | 'DEBIT';
  reason: string;
  idempotencyKey: string;
  adminId: string;
}) {
  assertPositiveMinor(input.amountMinor);
  const entry = await (input.direction === 'CREDIT'
    ? creditWallet({
        userId: input.userId,
        amountMinor: input.amountMinor,
        type: 'ADJUSTMENT_CREDIT',
        idempotencyKey: `admin-adjust:${input.idempotencyKey}`,
        description: `Admin adjustment: ${input.reason}`,
        createdBy: input.adminId,
      })
    : debitWallet({
        userId: input.userId,
        amountMinor: input.amountMinor,
        type: 'ADJUSTMENT_DEBIT',
        idempotencyKey: `admin-adjust:${input.idempotencyKey}`,
        description: `Admin adjustment: ${input.reason}`,
        createdBy: input.adminId,
      }));
  return entry;
}
