import mongoose, { ClientSession } from 'mongoose';
import { supportsTransactions } from '../config/db';
import { logger } from '../config/logger';
import { withKeyLock } from './sessionMutex';

/**
 * Executes `fn` inside a MongoDB transaction when the deployment supports it.
 *
 * On a standalone development database there is no multi-document atomicity.
 * In that mode we serialize wallet mutations per user with an in-process lock
 * and rely on unique ledger idempotency keys plus the reconciliation job.
 * This fallback is NOT considered production-safe and the server refuses to
 * boot in production without a replica set (REQUIRE_REPLICA_SET=true).
 */
export async function runInTransaction<T>(
  fn: (session?: ClientSession) => Promise<T>,
  lockKey?: string
): Promise<T> {
  if (supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction().catch(() => undefined);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  const execute = async () => fn(undefined);
  if (lockKey) {
    return withKeyLock(lockKey, execute);
  }
  return execute();
}

export function hasSession(session?: ClientSession | null): session is ClientSession {
  return Boolean(session);
}

export function withSession<T extends Record<string, unknown>>(options: T, session?: ClientSession) {
  return session ? { ...options, session } : options;
}

export function logTransactionMode(): void {
  logger.info({ mongoTransactions: supportsTransactions() }, 'Financial transaction mode');
}
