import { Referral, Transaction, User } from '../models';
import { getSetting } from './settingsService';
import { creditWallet } from './walletService';
import { notify } from './notificationService';
import { logger } from '../config/logger';
import { formatNaira } from '../utils/money';

/**
 * Called after a confirmed successful purchase. Awards the referrer exactly
 * once, only after the configured qualifying purchase threshold is reached.
 * Ledger idempotency prevents duplicate payouts.
 */
export async function qualifyReferral(
  userId: string,
  transactionId: string,
  payableMinor: number
): Promise<void> {
  try {
    const settings = await getSetting('referrals');
    if (!settings.enabled) return;
    if (payableMinor < settings.qualifyingPurchaseMinor) return;

    const referral = await Referral.findOne({ referredUserId: userId, status: 'PENDING' });
    if (!referral) return;

    referral.status = 'QUALIFIED';
    referral.qualifyingTransactionId = transactionId as unknown as import('mongoose').Types.ObjectId;
    referral.qualifiedAt = new Date();
    await referral.save();

    const referrer = await User.findById(referral.referrerId).lean();
    if (!referrer || referrer.status !== 'ACTIVE') {
      referral.status = 'REJECTED';
      await referral.save();
      return;
    }

    // Abuse guard: only real successful transactions qualify (caller guarantees this).
    const successfulCount = await Transaction.countDocuments({
      userId: referral.referredUserId,
      status: 'SUCCESSFUL',
    });
    if (successfulCount < 1) return;

    const referrerReferralCount = await Referral.countDocuments({
      referrerId: referral.referrerId,
      status: 'REWARDED',
    });
    if (referrerReferralCount >= settings.maxReferralsPerUser) {
      logger.warn({ referrerId: referral.referrerId }, 'Referral reward cap reached');
      return;
    }

    const reward = settings.rewardMinor;
    if (reward <= 0) {
      referral.status = 'REJECTED';
      await referral.save();
      return;
    }

    await creditWallet({
      userId: String(referral.referrerId),
      amountMinor: reward,
      type: 'REFERRAL_REWARD',
      idempotencyKey: `referral-reward:${String(referral._id)}`,
      description: `Referral reward for ${referral.code}`,
      metadata: { referredUserId: userId, transactionId },
    });

    referral.status = 'REWARDED';
    referral.rewardMinor = reward;
    referral.rewardedAt = new Date();
    await referral.save();

    await notify({
      userId: String(referral.referrerId),
      type: 'REFERRAL',
      title: 'Referral reward earned',
      body: `${formatNaira(reward)} was added to your wallet because your referral made a qualifying purchase.`,
      link: '/dashboard/referrals',
    });
  } catch (error) {
    // Referral failure must never affect a completed purchase.
    logger.error({ err: error, userId, transactionId }, 'Referral qualification failed');
  }
}

export async function getReferralSummary(userId: string) {
  const [settings, referrals, user] = await Promise.all([
    getSetting('referrals'),
    Referral.find({ referrerId: userId }).populate('referredUserId', 'fullName createdAt').sort({ createdAt: -1 }).lean(),
    User.findById(userId).select('referralCode').lean(),
  ]);
  const rewarded = referrals.filter((r) => r.status === 'REWARDED');
  const pending = referrals.filter((r) => r.status === 'PENDING' || r.status === 'QUALIFIED');
  return {
    enabled: settings.enabled,
    code: user?.referralCode ?? '',
    rewardMinor: settings.rewardMinor,
    qualifyingPurchaseMinor: settings.qualifyingPurchaseMinor,
    totals: {
      referrals: referrals.length,
      pending: pending.length,
      rewarded: rewarded.length,
      earnedMinor: rewarded.reduce((sum, r) => sum + (r.rewardMinor ?? 0), 0),
    },
    referrals: referrals.map((r) => {
      const referred = r.referredUserId as unknown as { fullName?: string; createdAt?: Date } | null;
      return {
        id: String(r._id),
        referredName: referred?.fullName ?? 'User',
        status: r.status,
        rewardMinor: r.rewardMinor,
        createdAt: r.createdAt,
        rewardedAt: r.rewardedAt,
      };
    }),
  };
}
