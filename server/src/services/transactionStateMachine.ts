import { ClientSession } from 'mongoose';
import { Transaction } from '../models';
import { TransactionStatus } from '../config/constants';
import { AppError } from '../utils/AppError';

/** Explicit allow-list of transaction state transitions. */
export const TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  CREATED: ['PENDING', 'FAILED'],
  PENDING: ['PROCESSING', 'FAILED', 'REQUIRES_REVIEW'],
  PROCESSING: ['SUCCESSFUL', 'FAILED', 'REQUIRES_REVIEW'],
  REQUIRES_REVIEW: ['PROCESSING', 'SUCCESSFUL', 'FAILED'],
  SUCCESSFUL: ['REVERSED'],
  FAILED: ['REFUNDED'],
  REVERSED: [],
  REFUNDED: [],
};

export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: TransactionStatus, to: TransactionStatus): void {
  if (!canTransition(from, to)) {
    throw AppError.conflict(`Invalid transaction transition ${from} → ${to}`, 'INVALID_STATE_TRANSITION');
  }
}

interface TransitionOptions {
  reason?: string;
  actorId?: string;
  session?: ClientSession;
  set?: Record<string, unknown>;
}

/**
 * Atomic conditional transition. If another worker already moved the
 * transaction, reload it and only accept the case where it already reached
 * the requested target. This prevents duplicate results/refunds.
 */
export async function transitionTransaction(
  transactionId: string,
  to: TransactionStatus,
  options: TransitionOptions = {}
) {
  const current = await Transaction.findById(transactionId).session(options.session ?? null);
  if (!current) throw AppError.notFound('Transaction not found');
  if (current.status === to) return { transaction: current, changed: false };
  assertTransition(current.status, to);

  const now = new Date();
  const set: Record<string, unknown> = { status: to, ...(options.set ?? {}) };
  if (to === 'SUCCESSFUL') set.completedAt = now;
  if (to === 'FAILED') set.completedAt = now;
  if (to === 'PENDING') set.nextReconcileAt = new Date(Date.now() + 2 * 60 * 1000);

  const update: Record<string, unknown> = {
    $set: set,
    $push: {
      statusHistory: {
        status: to,
        at: now,
        reason: options.reason ?? null,
        actorId: options.actorId ?? null,
      },
    },
  };

  const result = await Transaction.findOneAndUpdate(
    { _id: transactionId, status: current.status },
    update,
    { new: true, ...(options.session ? { session: options.session } : {}) }
  );

  if (!result) {
    const latest = await Transaction.findById(transactionId).session(options.session ?? null);
    if (latest?.status === to) return { transaction: latest, changed: false };
    throw AppError.conflict('Transaction state changed concurrently. Refresh and try again.', 'STATE_RACE');
  }

  return { transaction: result, changed: true };
}
