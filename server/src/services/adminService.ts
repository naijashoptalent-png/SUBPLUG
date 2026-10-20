import { Request } from 'express';
import { Types } from 'mongoose';
import {
  AuditLog,
  LedgerEntry,
  Provider,
  Transaction,
  User,
  Wallet,
  WalletFunding,
} from '../models';
import { AppError } from '../utils/AppError';
import { paginationMeta } from '../utils/pagination';
import { getVtuProvider } from '../providers';
import { getPaymentProvider } from '../providers/paymentIndex';
import { env } from '../config/env';
import { writeAudit } from './auditService';
import { adminAdjustWallet } from './walletService';
import { revokeAllSessions } from './tokenService';
import { notify } from './notificationService';
import { sendSecurityAlert } from './emailService';
import { getAllSettings, updateSetting } from './settingsService';
import { SETTING_KEYS } from '../config/constants';
import { checkAndConfirmFunding } from './fundingService';
import { listAdminPlans } from './catalogueService';
import { supportsTransactions } from '../config/db';

export async function getOverview(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [
    totalUsers,
    newUsers,
    statusAgg,
    serviceAgg,
    fundingAgg,
    revenueAgg,
    pendingCount,
    reviewFundings,
    providers,
    dailyAgg,
  ] = await Promise.all([
    User.countDocuments({ role: 'CUSTOMER' }),
    User.countDocuments({ role: 'CUSTOMER', createdAt: { $gte: since } }),
    Transaction.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$payableMinor' } } }]),
    Transaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$service', count: { $sum: 1 }, volumeMinor: { $sum: '$payableMinor' }, successful: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESSFUL'] }, 1, 0] } } } },
    ]),
    WalletFunding.aggregate([
      { $match: { status: 'SUCCESSFUL', createdAt: { $gte: since } } },
      { $group: { _id: null, totalMinor: { $sum: '$amountMinor' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { status: 'SUCCESSFUL', createdAt: { $gte: since } } },
      { $group: { _id: null, revenueMinor: { $sum: { $add: ['$marginMinor', '$feeMinor'] } }, volumeMinor: { $sum: '$payableMinor' } } },
    ]),
    Transaction.countDocuments({ status: { $in: ['PROCESSING', 'REQUIRES_REVIEW', 'PENDING'] } }),
    WalletFunding.countDocuments({ status: 'REQUIRES_REVIEW' }),
    Provider.find().lean(),
    Transaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          volumeMinor: { $sum: '$payableMinor' },
          revenueMinor: { $sum: { $add: ['$marginMinor', '$feeMinor'] } },
          successful: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESSFUL'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $in: ['$status', ['FAILED', 'REFUNDED']] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const statuses = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));
  const successful = statuses.SUCCESSFUL ?? 0;
  const failed = (statuses.FAILED ?? 0) + (statuses.REFUNDED ?? 0);

  return {
    periodDays: days,
    users: { total: totalUsers, new: newUsers },
    transactions: {
      total: statusAgg.reduce((sum, s) => sum + s.count, 0),
      successful,
      failed,
      pending: pendingCount,
      successRate: successful + failed > 0 ? Math.round((successful / (successful + failed)) * 1000) / 10 : null,
      statuses,
    },
    funding: {
      totalMinor: fundingAgg[0]?.totalMinor ?? 0,
      count: fundingAgg[0]?.count ?? 0,
      reviewCount: reviewFundings,
    },
    revenue: {
      grossMarginMinor: revenueAgg[0]?.revenueMinor ?? 0,
      transactionVolumeMinor: revenueAgg[0]?.volumeMinor ?? 0,
    },
    services: serviceAgg.map((s) => ({
      service: s._id,
      count: s.count,
      volumeMinor: s.volumeMinor,
      successful: s.successful,
    })),
    daily: dailyAgg,
    providers: providers.map((p) => ({
      key: p.key,
      name: p.name,
      kind: p.kind,
      health: p.health,
      enabled: p.enabled,
      isSandbox: p.isSandbox,
      lastCheckedAt: p.lastCheckedAt,
      lastError: p.lastError,
    })),
  };
}

export async function listUsers(options: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  role?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (options.status) filter.status = options.status;
  if (options.role) filter.role = options.role;
  if (options.search) {
    const safe = options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { fullName: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { phone: { $regex: safe } },
      { referralCode: { $regex: safe, $options: 'i' } },
    ];
  }
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('fullName email phone role status emailVerifiedAt createdAt lastLoginAt referralCode')
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return { users, pagination: paginationMeta(total, options.page, options.limit) };
}

export async function getUserDetail(userId: string) {
  if (!Types.ObjectId.isValid(userId)) throw AppError.badRequest('Invalid user id');
  const [user, wallet, txCounts, recentTx, fundings] = await Promise.all([
    User.findById(userId).lean(),
    Wallet.findOne({ userId }).lean(),
    Transaction.aggregate([{ $match: { userId: new Types.ObjectId(userId) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Transaction.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    WalletFunding.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  if (!user) throw AppError.notFound('User not found');
  return {
    user: {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
      twoFactorEnabled: user.twoFactorEnabled,
      referralCode: user.referralCode,
      suspensionReason: user.suspensionReason,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    wallet: wallet ? { balanceMinor: wallet.balanceMinor, status: wallet.status, currency: wallet.currency } : null,
    transactionCounts: Object.fromEntries(txCounts.map((t) => [t._id, t.count])),
    recentTransactions: recentTx.map((t) => ({ reference: t.reference, service: t.service, status: t.status, payableMinor: t.payableMinor, createdAt: t.createdAt })),
    recentFundings: fundings.map((f) => ({ reference: f.reference, amountMinor: f.amountMinor, status: f.status, createdAt: f.createdAt })),
  };
}

export async function setUserStatus(
  actorId: string,
  actorRole: string,
  actorName: string,
  userId: string,
  status: 'ACTIVE' | 'SUSPENDED',
  reason: string,
  req: Request
) {
  if (actorId === userId) throw AppError.badRequest('You cannot change your own account status', 'SELF_ACTION');
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('User not found');
  if (user.role === 'ADMIN' && actorRole !== 'ADMIN') throw AppError.forbidden('Only administrators can manage admin accounts');
  user.status = status;
  user.suspensionReason = status === 'SUSPENDED' ? reason : null;
  await user.save();
  if (status === 'SUSPENDED') {
    await revokeAllSessions(String(user._id));
    await notify({
      userId,
      type: 'SECURITY',
      title: 'Account suspended',
      body: reason,
    });
    await sendSecurityAlert(user.email, `Your account was suspended by support. Reason: ${reason}`);
  } else {
    await notify({ userId, type: 'SECURITY', title: 'Account reactivated', body: 'Your account has been reactivated.' });
  }
  await writeAudit({
    actorId,
    actorName,
    actorRole,
    action: status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
    entityType: 'User',
    entityId: userId,
    metadata: { reason },
    req,
  });
  return { id: userId, status: user.status };
}

export async function adjustWallet(
  actor: { id: string; name: string; role: string },
  input: { userId: string; amountMinor: number; direction: 'CREDIT' | 'DEBIT'; reason: string; idempotencyKey: string },
  req: Request
) {
  if (actor.role !== 'ADMIN') throw AppError.forbidden('Admin role required for wallet adjustments');
  const user = await User.findById(input.userId);
  if (!user) throw AppError.notFound('User not found');
  const entry = await adminAdjustWallet({
    userId: input.userId,
    amountMinor: input.amountMinor,
    direction: input.direction,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    adminId: actor.id,
  });
  await notify({
    userId: input.userId,
    type: 'SYSTEM',
    title: 'Wallet adjustment',
    body: `Your wallet was ${input.direction === 'CREDIT' ? 'credited' : 'debited'} by support. Reason: ${input.reason}`,
  });
  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: 'WALLET_ADJUSTED',
    entityType: 'Wallet',
    entityId: input.userId,
    metadata: { amountMinor: input.amountMinor, direction: input.direction, reason: input.reason, ledgerReference: entry.reference },
    req,
  });
  return entry;
}

export async function listAuditLogs(options: {
  page: number;
  limit: number;
  action?: string;
  actorId?: string;
  entityType?: string;
  from?: string;
  to?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (options.action) filter.action = options.action;
  if (options.actorId && Types.ObjectId.isValid(options.actorId)) filter.actorId = options.actorId;
  if (options.entityType) filter.entityType = options.entityType;
  if (options.from || options.to) {
    filter.createdAt = {
      ...(options.from ? { $gte: new Date(options.from) } : {}),
      ...(options.to ? { $lte: new Date(options.to) } : {}),
    };
  }
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { logs, pagination: paginationMeta(total, options.page, options.limit) };
}

export async function listProviders() {
  const [providers, vtu] = await Promise.all([Provider.find().lean(), Promise.resolve(getVtuProvider())]);
  let paymentKey = 'unconfigured';
  let paymentSandbox = false;
  try {
    const payment = getPaymentProvider();
    paymentKey = payment.key;
    paymentSandbox = payment.isSandbox;
  } catch {
    paymentKey = 'unconfigured';
  }
  return {
    providers: providers.map((p) => ({
      key: p.key,
      name: p.name,
      kind: p.kind,
      adapter: p.adapter,
      enabled: p.enabled,
      isSandbox: p.isSandbox,
      health: p.health,
      lastCheckedAt: p.lastCheckedAt,
      lastError: p.lastError,
      errorCount: p.errorCount,
    })),
    activeVtu: { key: vtu.key, name: vtu.name, isSandbox: vtu.isSandbox },
    payment: { key: paymentKey, isSandbox: paymentSandbox, configured: paymentKey !== 'unconfigured' },
  };
}

export async function checkProviders(actorId: string, actorRole: string, actorName: string, req: Request) {
  const results: Array<Record<string, unknown>> = [];
  try {
    const vtu = getVtuProvider();
    const health = await vtu.healthCheck();
    await Provider.findOneAndUpdate(
      { key: vtu.key },
      {
        $set: {
          health: health.healthy ? 'HEALTHY' : 'DOWN',
          lastCheckedAt: new Date(),
          lastError: health.healthy ? null : health.message?.slice(0, 500) ?? 'Unhealthy',
        },
        $inc: { errorCount: health.healthy ? 0 : 1 },
      },
      { upsert: true }
    );
    results.push({ provider: vtu.key, kind: 'VTU', ...health });
  } catch (error) {
    results.push({ provider: 'vtu', kind: 'VTU', healthy: false, message: error instanceof Error ? error.message : 'Error' });
  }
  try {
    const payment = getPaymentProvider();
    const health = await payment.healthCheck();
    await Provider.findOneAndUpdate(
      { key: payment.key },
      {
        $set: {
          name: payment.name,
          kind: 'PAYMENT',
          adapter: payment.key,
          isSandbox: payment.isSandbox,
          health: health.healthy ? 'HEALTHY' : 'DOWN',
          lastCheckedAt: new Date(),
          lastError: health.healthy ? null : health.message?.slice(0, 500) ?? 'Unhealthy',
        },
        $setOnInsert: { errorCount: 0 },
      },
      { upsert: true }
    );
    results.push({ provider: payment.key, kind: 'PAYMENT', ...health });
  } catch (error) {
    results.push({ provider: 'payment', kind: 'PAYMENT', healthy: false, message: error instanceof Error ? error.message : 'Error' });
  }
  await writeAudit({
    actorId,
    actorName,
    actorRole,
    action: 'PROVIDER_HEALTH_CHECKED',
    entityType: 'Provider',
    metadata: { results },
    req,
  });
  return results;
}

export async function getSettings() {
  return getAllSettings();
}

export async function saveSetting(
  actor: { id: string; name: string; role: string },
  key: string,
  value: Record<string, unknown>,
  req: Request
) {
  if (!Object.values(SETTING_KEYS).includes(key as never)) {
    throw AppError.badRequest('Unknown settings key', 'INVALID_SETTING_KEY');
  }
  if (key === 'maintenance' && value.enabled === true) {
    // High-impact action still allowed, but audited with explicit metadata.
    await writeAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'MAINTENANCE_MODE_ENABLED',
      entityType: 'SystemSetting',
      entityId: key,
      metadata: { message: value.message },
      req,
    });
  }
  const updated = await updateSetting(key as never, value, actor.id);
  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: 'SYSTEM_SETTING_UPDATED',
    entityType: 'SystemSetting',
    entityId: key,
    metadata: { keys: Object.keys(value) },
    req,
  });
  return updated;
}

export async function getAdminPlans(options: {
  service?: string;
  network?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  return listAdminPlans(options);
}

export async function listFundingsAdmin(options: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  userId?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (options.status) filter.status = options.status;
  if (options.userId && Types.ObjectId.isValid(options.userId)) filter.userId = options.userId;
  if (options.search) filter.reference = { $regex: options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [fundings, total] = await Promise.all([
    WalletFunding.find(filter).sort({ createdAt: -1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    WalletFunding.countDocuments(filter),
  ]);
  return { fundings, pagination: paginationMeta(total, options.page, options.limit) };
}

export async function recheckFunding(
  actor: { id: string; name: string; role: string },
  reference: string,
  req: Request
) {
  const result = await checkAndConfirmFunding(reference);
  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: 'FUNDING_RECHECKED',
    entityType: 'WalletFunding',
    entityId: reference,
    metadata: { outcome: result.status },
    req,
  });
  return result;
}

export async function getReconciliationSnapshot() {
  const [walletCount, ledgerCount, pendingTx, reviewTx, reviewFunding] = await Promise.all([
    Wallet.countDocuments(),
    LedgerEntry.countDocuments(),
    Transaction.countDocuments({ status: { $in: ['PENDING', 'PROCESSING'] } }),
    Transaction.countDocuments({ status: 'REQUIRES_REVIEW' }),
    WalletFunding.countDocuments({ status: 'REQUIRES_REVIEW' }),
  ]);
  return {
    walletCount,
    ledgerCount,
    pendingTransactions: pendingTx,
    transactionsInReview: reviewTx,
    fundingsInReview: reviewFunding,
    environment: { nodeEnv: env.NODE_ENV, mongoTransactions: supportsTransactions() },
  };
}
