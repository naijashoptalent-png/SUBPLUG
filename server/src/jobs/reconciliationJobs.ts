import { LedgerEntry, Transaction, WalletFunding } from '../models';
import { getVtuProviderByKey } from '../providers';
import { getPaymentProvider } from '../providers/paymentIndex';
import { applyProviderOutcome } from '../services/purchaseService';
import { confirmFunding, reconcileVirtualAccountTransfers } from '../services/fundingService';
import { transitionTransaction } from '../services/transactionStateMachine';
import { refundTransaction, reconcileWallets } from '../services/walletService';
import { notify } from '../services/notificationService';
import { logger } from '../config/logger';
import { formatNaira } from '../utils/money';

export async function reconcileTransactions(limit = 25) {
  const due = await Transaction.find({
    status: { $in: ['PROCESSING', 'REQUIRES_REVIEW'] },
    providerSubmittedAt: { $ne: null },
    nextReconcileAt: { $lte: new Date() },
    reconciliationAttempts: { $lt: 8 },
  })
    .sort({ nextReconcileAt: 1 })
    .limit(limit);

  let checked = 0;
  let resolved = 0;

  for (const transaction of due) {
    checked += 1;
    try {
      await Transaction.updateOne(
        { _id: transaction._id },
        { $inc: { reconciliationAttempts: 1 }, $set: { reconciledAt: new Date() } }
      );
      const provider = getVtuProviderByKey(transaction.provider);
      const result = await provider.queryStatus(transaction.reference);
      const updated = await applyProviderOutcome(
        String(transaction.userId),
        String(transaction._id),
        result,
        'reconciliation'
      );
      if (['SUCCESSFUL', 'FAILED', 'REFUNDED'].includes(updated.status)) resolved += 1;
    } catch (error) {
      logger.warn({ err: error, reference: transaction.reference }, 'Transaction reconciliation failed');
    }
  }
  return { checked, resolved };
}

/**
 * A purchase can become stuck in PENDING only if the process stopped between
 * the wallet debit and provider submission. Never auto-submit or auto-refund:
 * flag it for a human if the debit exists, fail it if no debit is linked.
 */
export async function flagStalePendingTransactions(limit = 20) {
  const stale = await Transaction.find({
    status: 'PENDING',
    providerSubmittedAt: null,
    createdAt: { $lte: new Date(Date.now() - 10 * 60 * 1000) },
  }).limit(limit);

  let flagged = 0;
  for (const transaction of stale) {
    const debit = await LedgerEntry.exists({
      transactionId: transaction._id,
      type: 'PURCHASE_DEBIT',
    });
    if (debit) {
      try {
        await transitionTransaction(String(transaction._id), 'REQUIRES_REVIEW', {
          reason: 'Stale pending transaction — process stopped before provider submission',
          set: {
            reviewReason: 'Stale pending transaction requires manual review',
            nextReconcileAt: null,
          },
        });
        await notify({
          userId: String(transaction.userId),
          type: 'PURCHASE',
          title: 'Purchase under review',
          body: `Your purchase ${transaction.reference} is safe and awaiting manual completion. Please do not retry.`,
          link: `/dashboard/transactions/${transaction.reference}`,
        });
        flagged += 1;
      } catch (error) {
        logger.warn({ err: error, reference: transaction.reference }, 'Could not flag stale transaction');
      }
    } else {
      await transitionTransaction(String(transaction._id), 'FAILED', {
        reason: 'Stale transaction without wallet debit',
        set: { failureReason: 'Purchase never reached the provider and no debit was recorded' },
      });
    }
  }
  return flagged;
}

export async function retryFailedRefunds(limit = 20) {
  const pending = await Transaction.find({
    status: 'FAILED',
    refundedAt: null,
    completedAt: { $lte: new Date(Date.now() - 60 * 1000) },
  }).limit(limit);

  let refunded = 0;
  for (const transaction of pending) {
    try {
      await refundTransaction(String(transaction._id), 'Retry of confirmed provider failure refund');
      refunded += 1;
      await notify({
        userId: String(transaction.userId),
        type: 'REFUND',
        title: 'Refund completed',
        body: `${formatNaira(transaction.payableMinor)} was returned to your wallet for ${transaction.reference}.`,
        link: `/dashboard/transactions/${transaction.reference}`,
      });
    } catch (error) {
      logger.error({ err: error, reference: transaction.reference }, 'Refund retry failed');
    }
  }
  return refunded;
}

export async function reconcileFundings(limit = 25) {
  const pending = await WalletFunding.find({
    status: 'PENDING',
    createdAt: { $lte: new Date(Date.now() - 2 * 60 * 1000) },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  let credited = 0;
  for (const funding of pending) {
    try {
      const provider = getPaymentProvider(funding.gateway);
      const verification = await provider.verify(funding.reference);
      const result = await confirmFunding(funding.reference, verification, 'reconciliation');
      if (result.status === 'SUCCESSFUL') credited += 1;
    } catch (error) {
      logger.warn({ err: error, reference: funding.reference }, 'Funding reconciliation failed');
    }
  }
  return { checked: pending.length, credited };
}

export async function runWalletDriftCheck() {
  try {
    const result = await reconcileWallets(500);
    if (result.discrepancies.length > 0) {
      logger.error({ discrepancies: result.discrepancies.length }, 'WALLET DRIFT DETECTED — manual investigation required');
    }
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Wallet reconciliation check failed');
    return { checked: 0, discrepancies: [] };
  }
}

export async function runReconciliationCycle() {
  const [transactions, fundings, virtualAccounts, refunds, stale] = await Promise.allSettled([
    reconcileTransactions(),
    reconcileFundings(),
    reconcileVirtualAccountTransfers(),
    retryFailedRefunds(),
    flagStalePendingTransactions(),
  ]);
  const summary = {
    transactions: transactions.status === 'fulfilled' ? transactions.value : null,
    fundings: fundings.status === 'fulfilled' ? fundings.value : null,
    virtualAccounts: virtualAccounts.status === 'fulfilled' ? virtualAccounts.value : null,
    refunds: refunds.status === 'fulfilled' ? refunds.value : null,
    staleFlagged: stale.status === 'fulfilled' ? stale.value : null,
  };
  logger.info(summary, 'Reconciliation cycle completed');
  return summary;
}
