import { Request } from 'express';
import { FilterQuery, Query, Types } from 'mongoose';
import { ServicePlan, Transaction, User } from '../models';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { hashRequestPayload } from '../utils/crypto';
import { generateReference } from '../utils/reference';
import { formatNaira } from '../utils/money';
import { sanitizeProviderPayload } from '../utils/redact';
import { paginationMeta } from '../utils/pagination';
import { runInTransaction } from '../utils/transactionRunner';
import { debitWallet, refundTransaction } from './walletService';
import { quoteAirtime, getEnabledPlan } from './catalogueService';
import { getSetting } from './settingsService';
import { getVtuProvider } from '../providers';
import { ProviderPurchaseResult, ProviderStatusResult, ProviderPurchaseRequest } from '../providers/types';
import { normalizePhone } from './authService';
import { transitionTransaction } from './transactionStateMachine';
import { notify } from './notificationService';
import { sendPurchaseStatus } from './emailService';
import { qualifyReferral } from './referralService';
import { writeAudit } from './auditService';
import { ITransaction } from '../models/Transaction';
import { TransactionStatus } from '../config/constants';

interface Actor {
  userId: string;
  role: string;
  req?: Request;
}

interface PreparedPurchase {
  service: 'AIRTIME' | 'DATA' | 'ELECTRICITY' | 'CABLE';
  amountMinor: number;
  payableMinor: number;
  feeMinor: number;
  discountMinor: number;
  costMinor: number;
  marginMinor: number;
  providerRequest: ProviderPurchaseRequest;
  recipient: ITransaction['recipient'];
  plan?: ITransaction['plan'];
  fulfillment?: ITransaction['fulfillment'];
  requestHash: string;
  description: string;
  isSandbox: boolean;
}

function selectWithToken<T extends Query<any, any>>(query: T): T {
  return query.select('+fulfillment.token +fulfillment.units') as T;
}

function serialise(transaction: ITransaction, includeAdmin = false) {
  const isSandbox = Boolean((transaction.metadata as Record<string, unknown> | null)?.isSandbox);
  return {
    id: String(transaction._id),
    reference: transaction.reference,
    userId: includeAdmin ? String(transaction.userId) : undefined,
    service: transaction.service,
    amountMinor: transaction.amountMinor,
    payableMinor: transaction.payableMinor,
    feeMinor: transaction.feeMinor,
    discountMinor: transaction.discountMinor,
    costMinor: includeAdmin ? transaction.costMinor : undefined,
    marginMinor: includeAdmin ? transaction.marginMinor : undefined,
    currency: transaction.currency,
    status: transaction.status,
    paymentMethod: transaction.paymentMethod,
    provider: transaction.provider,
    providerReference: transaction.providerReference,
    providerStatus: transaction.providerStatus,
    providerPayload: includeAdmin ? transaction.providerPayload : undefined,
    reviewReason: transaction.reviewReason,
    recipient: transaction.recipient,
    plan: transaction.plan,
    fulfillment: {
      token: transaction.fulfillment?.token ?? null,
      units: transaction.fulfillment?.units ?? null,
      customerName: transaction.fulfillment?.customerName ?? null,
      customerAddress: transaction.fulfillment?.customerAddress ?? null,
    },
    failureReason: transaction.failureReason,
    refundedAt: transaction.refundedAt,
    refundedAmountMinor: transaction.refundedAmountMinor,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    completedAt: transaction.completedAt,
    statusHistory: transaction.statusHistory,
    isSandbox,
    metadata: includeAdmin ? transaction.metadata : { isSandbox },
  };
}

function startOfLagosDay(): Date {
  const now = new Date();
  const lagosMillis = now.getTime() + 60 * 60 * 1000;
  const lagos = new Date(lagosMillis);
  lagos.setUTCHours(0, 0, 0, 0);
  return new Date(lagos.getTime() - 60 * 60 * 1000);
}

async function assertDailyLimit(userId: string, additionalMinor: number) {
  const limits = await getSetting('limits');
  const result = await Transaction.aggregate([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        createdAt: { $gte: startOfLagosDay() },
        status: { $in: ['PENDING', 'PROCESSING', 'SUCCESSFUL', 'REQUIRES_REVIEW'] },
      },
    },
    { $group: { _id: null, total: { $sum: '$payableMinor' } } },
  ]);
  const spent = result[0]?.total ?? 0;
  if (spent + additionalMinor > limits.maxDailySpendMinor) {
    throw AppError.forbidden(
      `This purchase would exceed your daily spending limit of ${formatNaira(limits.maxDailySpendMinor)}. Contact support to request a higher limit.`,
      'DAILY_LIMIT_EXCEEDED'
    );
  }
}

async function findExisting(userId: string, idempotencyKey: string, requestHash: string) {
  const existing = await selectWithToken(Transaction.findOne({ userId, idempotencyKey }));
  if (!existing) return null;
  if (existing.requestHash !== requestHash) {
    throw AppError.conflict('Idempotency key was reused with different purchase details', 'IDEMPOTENCY_MISMATCH');
  }
  return { transaction: existing, serialized: serialise(existing) };
}

async function createPurchase(actor: Actor, prepared: PreparedPurchase, idempotencyKey: string) {
  const existing = await findExisting(actor.userId, idempotencyKey, prepared.requestHash);
  if (existing) return { ...existing.serialized, duplicate: true };

  await assertDailyLimit(actor.userId, prepared.payableMinor);

  const provider = getVtuProvider();
  let transaction: ITransaction;
  try {
    transaction = await runInTransaction(async (session) => {
      const [created] = await Transaction.create(
        [
          {
            reference: generateReference('TXN'),
            userId: actor.userId,
            service: prepared.service,
            amountMinor: prepared.amountMinor,
            payableMinor: prepared.payableMinor,
            feeMinor: prepared.feeMinor,
            discountMinor: prepared.discountMinor,
            costMinor: prepared.costMinor,
            marginMinor: prepared.marginMinor,
            status: 'CREATED',
            statusHistory: [{ status: 'CREATED', at: new Date(), reason: 'Purchase requested' }],
            provider: provider.key,
            idempotencyKey,
            requestHash: prepared.requestHash,
            paymentMethod: 'WALLET',
            recipient: prepared.recipient,
            plan: prepared.plan,
            fulfillment: prepared.fulfillment,
            metadata: {
              isSandbox: prepared.isSandbox,
              description: prepared.description,
              providerRequest: prepared.providerRequest,
            },
          },
        ],
        session ? { session } : {}
      );

      await debitWallet({
        userId: actor.userId,
        amountMinor: prepared.payableMinor,
        type: 'PURCHASE_DEBIT',
        idempotencyKey: `purchase-debit:${String(created._id)}`,
        description: prepared.description,
        transactionId: String(created._id),
        metadata: { service: prepared.service, reference: created.reference },
        session,
      });

      const result = await transitionTransaction(String(created._id), 'PENDING', {
        reason: 'Wallet debited; preparing provider request',
        session,
      });
      return result.transaction;
    }, `wallet:${actor.userId}`);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const race = await findExisting(actor.userId, idempotencyKey, prepared.requestHash);
      if (race) return { ...race.serialized, duplicate: true };
    }
    throw error;
  }

  const limits = await getSetting('limits');
  if (prepared.payableMinor >= limits.manualReviewThresholdMinor) {
    const reviewed = await transitionTransaction(String(transaction._id), 'REQUIRES_REVIEW', {
      reason: `Held for manual approval: amount ${formatNaira(prepared.payableMinor)} meets review threshold`,
      set: {
        reviewReason: 'High-value purchase awaiting manual approval',
        nextReconcileAt: null,
      },
    });
    await notify({
      userId: actor.userId,
      type: 'PURCHASE',
      title: 'Purchase under review',
      body: `${prepared.description} is being reviewed before it is sent to the provider. ${formatNaira(prepared.payableMinor)} has been reserved from your wallet.`,
      link: `/dashboard/transactions/${transaction.reference}`,
    });
    return { ...serialise(reviewed.transaction), duplicate: false, heldForReview: true };
  }

  const completed = await submitToProvider(actor.userId, String(transaction._id));
  return { ...serialise(completed), duplicate: false };
}

async function submitToProvider(userId: string, transactionId: string): Promise<ITransaction> {
  let transaction = await selectWithToken(Transaction.findOne({ _id: transactionId, userId }));
  if (!transaction) throw AppError.notFound('Transaction not found');
  if (['SUCCESSFUL', 'FAILED', 'REFUNDED', 'REVERSED'].includes(transaction.status)) return transaction;

  if (transaction.status === 'PENDING') {
    transaction = (
      await transitionTransaction(transactionId, 'PROCESSING', {
        reason: 'Submitting to provider',
      })
    ).transaction;
  } else if (transaction.status === 'REQUIRES_REVIEW' && !transaction.providerSubmittedAt) {
    transaction = (
      await transitionTransaction(transactionId, 'PROCESSING', {
        reason: 'Manual review approved; submitting to provider',
      })
    ).transaction;
  } else if (transaction.status !== 'PROCESSING') {
    throw AppError.conflict(`Cannot submit a transaction in ${transaction.status} state`, 'INVALID_STATE');
  }

  // Claim submission atomically so two workers cannot call the provider twice.
  const claimed = await Transaction.findOneAndUpdate(
    { _id: transactionId, providerSubmittedAt: null, status: 'PROCESSING' },
    { $set: { providerSubmittedAt: new Date() } },
    { new: true }
  ).select('+fulfillment.token +fulfillment.units');

  if (!claimed) {
    const current = await selectWithToken(Transaction.findById(transactionId));
    if (!current) throw AppError.notFound('Transaction not found');
    return current;
  }
  transaction = claimed;

  const provider = getVtuProvider();
  let result: ProviderPurchaseResult;
  try {
    const storedRequest = transaction.metadata?.providerRequest as ProviderPurchaseRequest | undefined;
    if (!storedRequest) {
      throw new Error('Stored provider request is missing');
    }
    result = await provider.purchase({
      ...storedRequest,
      reference: transaction.reference,
    });
  } catch (error) {
    logger.error({ err: error, reference: transaction.reference }, 'Provider purchase threw — outcome unknown');
    result = {
      outcome: 'UNCERTAIN',
      providerStatus: 'REQUEST_EXCEPTION',
      message: 'Provider request failed without a definitive outcome. No retry was made.',
    };
  }

  await Transaction.updateOne(
    { _id: transactionId },
    {
      $set: {
        providerReference: result.providerReference ?? transaction.providerReference ?? null,
        providerStatus: result.providerStatus ?? result.outcome,
        providerPayload: sanitizeProviderPayload(result.raw ?? result) as Record<string, unknown>,
      },
    }
  );

  return applyProviderOutcome(userId, transactionId, result, 'purchase');
}

export async function applyProviderOutcome(
  userId: string,
  transactionId: string,
  result: ProviderStatusResult,
  source: 'purchase' | 'reconciliation' | 'admin'
): Promise<ITransaction> {
  let transaction = await selectWithToken(Transaction.findById(transactionId));
  if (!transaction) throw AppError.notFound('Transaction not found');

  const providerReference = result.providerReference ?? transaction.providerReference ?? null;
  const providerStatus = result.providerStatus ?? result.outcome;

  if (result.outcome === 'SUCCESS') {
    if (transaction.status === 'REFUNDED' || transaction.status === 'FAILED' || transaction.status === 'REVERSED') {
      logger.error(
        { reference: transaction.reference, status: transaction.status, providerReference },
        'CRITICAL: provider reports success after a terminal failure/refund. Manual reconciliation required.'
      );
      await Transaction.updateOne(
        { _id: transaction._id },
        {
          $set: {
            providerStatus,
            reviewReason: 'Provider reported success after local failure/refund — manual reconciliation required',
            status: 'REQUIRES_REVIEW',
            nextReconcileAt: null,
          },
          $push: {
            statusHistory: {
              status: 'REQUIRES_REVIEW',
              at: new Date(),
              reason: 'Late provider success — manual reconciliation required',
            },
          },
        }
      );
      throw AppError.conflict(
        'Provider reported a late success after refund. This requires manual reconciliation.',
        'LATE_PROVIDER_SUCCESS'
      );
    }

    const transition = await transitionTransaction(transactionId, 'SUCCESSFUL', {
      reason: `Provider confirmed success (${source})`,
      set: {
        providerReference,
        providerStatus,
        providerPayload: sanitizeProviderPayload(result.raw ?? result) as Record<string, unknown>,
        failureReason: null,
        reconciledAt: new Date(),
        nextReconcileAt: null,
        'fulfillment.token': result.token ?? transaction.fulfillment?.token ?? null,
        'fulfillment.units': result.units ?? transaction.fulfillment?.units ?? null,
        'fulfillment.customerName': result.customerName ?? transaction.fulfillment?.customerName ?? null,
      },
    });
    // The token and units fields are excluded by default, so re-read with the
    // explicit projection before serialising the receipt for the customer.
    const reloaded = await selectWithToken(Transaction.findById(transactionId));
    if (reloaded) transaction = reloaded;

    const metadata = (transaction.metadata ?? {}) as Record<string, unknown>;
    const description = String(metadata.description ?? `${transaction.service} purchase`);
    if (transition.changed) {
      await notify({
        userId,
        type: 'PURCHASE',
        title: 'Purchase successful',
        body: `${description} completed. Reference: ${transaction.reference}`,
        link: `/dashboard/transactions/${transaction.reference}`,
        metadata: { reference: transaction.reference },
      });
      if (env.TRANSACTION_EMAIL_ALERTS) {
        const user = await User.findById(userId).lean();
        if (user) await sendPurchaseStatus(user.email, transaction.reference, 'Successful', `${description} was confirmed by the provider.`);
      }
      await qualifyReferral(userId, transactionId, transaction.payableMinor);
    }
    return transaction;
  }

  if (result.outcome === 'FAILED') {
    if (transaction.status === 'FAILED' || transaction.status === 'REFUNDED') return transaction;
    if (transaction.status === 'SUCCESSFUL') {
      logger.error({ reference: transaction.reference }, 'Provider reports failure for a locally successful transaction');
      throw AppError.conflict('Provider status conflicts with a successful transaction. Manual review required.', 'STATUS_CONFLICT');
    }
    const transition = await transitionTransaction(transactionId, 'FAILED', {
      reason: result.message ?? 'Provider reported failure',
      set: {
        providerReference,
        providerStatus,
        providerPayload: sanitizeProviderPayload(result.raw ?? result) as Record<string, unknown>,
        failureReason: (result.message ?? 'Provider reported failure').slice(0, 500),
        reconciledAt: new Date(),
        nextReconcileAt: null,
      },
    });
    transaction = transition.transaction;

    try {
      await refundTransaction(transactionId, result.message ?? 'Provider confirmed failure');
    } catch (error) {
      logger.error({ err: error, reference: transaction.reference }, 'Automatic refund failed; retry job will attempt again');
    }

    const refunded = await selectWithToken(Transaction.findById(transactionId));
    const metadata = (transaction.metadata ?? {}) as Record<string, unknown>;
    const description = String(metadata.description ?? `${transaction.service} purchase`);
    if (transition.changed) {
      await notify({
        userId,
        type: 'REFUND',
        title: refunded?.status === 'REFUNDED' ? 'Purchase failed — refunded' : 'Purchase failed',
        body:
          refunded?.status === 'REFUNDED'
            ? `${description} could not be completed. ${formatNaira(transaction.payableMinor)} was returned to your wallet.`
            : `${description} failed at the provider. A refund is being processed.`,
        link: `/dashboard/transactions/${transaction.reference}`,
      });
    }
    return refunded ?? transaction;
  }

  if (result.outcome === 'PENDING') {
    await Transaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          status: transaction.status === 'CREATED' ? 'PROCESSING' : transaction.status,
          providerReference,
          providerStatus,
          providerPayload: sanitizeProviderPayload(result.raw ?? result) as Record<string, unknown>,
          nextReconcileAt: new Date(Date.now() + 5 * 60 * 1000),
          reconciledAt: new Date(),
        },
      }
    );
    return (await selectWithToken(Transaction.findById(transactionId)))!;
  }

  // UNCERTAIN: preserve funds, never retry the purchase, require reconciliation.
  if (transaction.status === 'PROCESSING') {
    const transition = await transitionTransaction(transactionId, 'REQUIRES_REVIEW', {
      reason: result.message ?? 'Uncertain provider outcome',
      set: {
        providerReference,
        providerStatus,
        providerPayload: sanitizeProviderPayload(result.raw ?? result) as Record<string, unknown>,
        reviewReason: 'Provider outcome uncertain — funds reserved, no automatic retry',
        nextReconcileAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    transaction = transition.transaction;
    await notify({
      userId,
      type: 'PURCHASE',
      title: 'Purchase is being confirmed',
      body: `${transaction.reference} is awaiting confirmation from the provider. Do not retry — support will reconcile it.`,
      link: `/dashboard/transactions/${transaction.reference}`,
    });
  } else if (transaction.status === 'REQUIRES_REVIEW') {
    await Transaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          providerReference,
          providerStatus,
          providerPayload: sanitizeProviderPayload(result.raw ?? result) as Record<string, unknown>,
          nextReconcileAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      }
    );
  } else {
    logger.warn({ reference: transaction.reference, status: transaction.status }, 'Uncertain provider outcome for terminal transaction');
  }
  return (await selectWithToken(Transaction.findById(transactionId)))!;
}

export async function purchaseAirtime(
  actor: Actor,
  input: { network: string; phone: string; amountMinor: number; idempotencyKey: string }
) {
  const network = input.network.toUpperCase();
  const phone = normalizePhone(input.phone);
  const quote = await quoteAirtime(network, input.amountMinor);
  const provider = getVtuProvider();
  const requestHash = hashRequestPayload({ service: 'AIRTIME', network, phone, amountMinor: input.amountMinor, version: 1 });
  return createPurchase(
    actor,
    {
      service: 'AIRTIME',
      amountMinor: quote.faceValueMinor,
      payableMinor: quote.payableMinor,
      feeMinor: quote.feeMinor,
      discountMinor: quote.discountMinor,
      // Provider cost is not exposed to us by the airtime quote; do not fabricate margin.
      costMinor: quote.payableMinor,
      marginMinor: 0,
      providerRequest: {
        reference: '',
        service: 'AIRTIME',
        network,
        phone,
        amountMinor: quote.faceValueMinor,
      },
      recipient: { phone, network },
      requestHash,
      description: `${network} airtime of ${formatNaira(quote.faceValueMinor)} to ${phone}`,
      isSandbox: provider.isSandbox,
    },
    input.idempotencyKey
  );
}

export async function purchaseData(
  actor: Actor,
  input: { network: string; phone: string; providerPlanId: string; idempotencyKey: string }
) {
  const network = input.network.toUpperCase();
  const phone = normalizePhone(input.phone);
  const plan = await getEnabledPlan('DATA', input.providerPlanId);
  if (plan.network !== network) throw AppError.badRequest('Selected plan does not belong to this network', 'PLAN_NETWORK_MISMATCH');
  const limits = await getSetting('limits');
  if (plan.sellingPriceMinor < limits.dataMinMinor || plan.sellingPriceMinor > limits.dataMaxMinor) {
    throw AppError.badRequest('This data plan is outside the allowed purchase limits', 'AMOUNT_OUT_OF_RANGE');
  }
  const provider = getVtuProvider();
  const requestHash = hashRequestPayload({
    service: 'DATA',
    network,
    phone,
    providerPlanId: input.providerPlanId,
    version: 1,
  });
  return createPurchase(
    actor,
    {
      service: 'DATA',
      amountMinor: plan.sellingPriceMinor,
      payableMinor: plan.sellingPriceMinor,
      feeMinor: 0,
      discountMinor: 0,
      costMinor: plan.costMinor,
      marginMinor: plan.sellingPriceMinor - plan.costMinor,
      providerRequest: {
        reference: '',
        service: 'DATA',
        network,
        phone,
        planCode: plan.providerPlanId,
        amountMinor: plan.sellingPriceMinor,
        packageCode: plan.providerPlanId,
      },
      recipient: { phone, network },
      plan: {
        code: plan.providerPlanId,
        name: plan.name,
        dataVolume: plan.dataVolume ?? undefined,
        validity: plan.validity ?? undefined,
      },
      requestHash,
      description: `${plan.name} (${plan.dataVolume}) for ${phone} on ${network}`,
      isSandbox: provider.isSandbox || plan.isSandbox,
    },
    input.idempotencyKey
  );
}

export async function purchaseElectricity(
  actor: Actor,
  input: {
    disco: string;
    meterNumber: string;
    meterType: 'PREPAID' | 'POSTPAID';
    amountMinor: number;
    idempotencyKey: string;
  }
) {
  const disco = input.disco.toUpperCase();
  const meterNumber = input.meterNumber.replace(/\s/g, '');
  if (!/^\d{10,13}$/.test(meterNumber)) throw AppError.badRequest('Meter number must be 10–13 digits', 'INVALID_METER');
  const discoPlan = await ServicePlan.findOne({
    service: 'ELECTRICITY',
    providerPlanId: disco,
    enabled: true,
    'metadata.kind': 'DISCO',
  }).lean();
  if (!discoPlan) throw AppError.badRequest('This electricity provider is not available', 'INVALID_DISCO');

  const [limits, pricing] = await Promise.all([getSetting('limits'), getSetting('pricing')]);
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < limits.electricityMinMinor || input.amountMinor > limits.electricityMaxMinor) {
    throw AppError.badRequest(
      `Electricity amount must be between ${formatNaira(limits.electricityMinMinor)} and ${formatNaira(limits.electricityMaxMinor)}`,
      'AMOUNT_OUT_OF_RANGE'
    );
  }

  const provider = getVtuProvider();
  const requestHash = hashRequestPayload({
    service: 'ELECTRICITY',
    disco,
    meterNumber,
    meterType: input.meterType,
    amountMinor: input.amountMinor,
    version: 1,
  });
  const existing = await findExisting(actor.userId, input.idempotencyKey, requestHash);
  if (existing) return { ...existing.serialized, duplicate: true };

  const validation = await provider.validateMeter({ disco, meterNumber, meterType: input.meterType });
  if (!validation.valid) {
    throw AppError.badRequest(validation.message ?? 'Meter could not be validated', 'INVALID_METER');
  }

  const fee = pricing.electricityFeeMinor;
  return createPurchase(
    actor,
    {
      service: 'ELECTRICITY',
      amountMinor: input.amountMinor,
      payableMinor: input.amountMinor + fee,
      feeMinor: fee,
      discountMinor: 0,
      costMinor: input.amountMinor,
      marginMinor: fee,
      providerRequest: {
        reference: '',
        service: 'ELECTRICITY',
        amountMinor: input.amountMinor,
        meterNumber,
        meterType: input.meterType,
        disco,
      },
      recipient: {
        meterNumber,
        meterType: input.meterType,
        disco,
        customerName: validation.customerName,
      },
      fulfillment: {
        customerName: validation.customerName ?? null,
        customerAddress: validation.customerAddress ?? null,
        token: null,
        units: null,
      },
      requestHash,
      description: `${input.meterType.toLowerCase()} electricity ${formatNaira(input.amountMinor)} for ${disco} meter ${meterNumber}`,
      isSandbox: provider.isSandbox,
    },
    input.idempotencyKey
  );
}

export async function purchaseCable(
  actor: Actor,
  input: {
    cableProvider: string;
    smartcardNumber: string;
    providerPlanId: string;
    idempotencyKey: string;
  }
) {
  const cableProvider = input.cableProvider.toUpperCase();
  const smartcardNumber = input.smartcardNumber.replace(/\s/g, '');
  if (!/^\d{8,12}$/.test(smartcardNumber)) {
    throw AppError.badRequest('Smartcard/decoder number must be 8–12 digits', 'INVALID_SMARTCARD');
  }
  const network = await ServicePlan.findOne({
    service: 'CABLE',
    providerPlanId: `__NETWORK__:${cableProvider}`,
    enabled: true,
  }).lean();
  if (!network) throw AppError.badRequest('Cable provider is not available', 'INVALID_CABLE_PROVIDER');

  const plan = await getEnabledPlan('CABLE', input.providerPlanId);
  if (plan.network !== cableProvider) throw AppError.badRequest('Selected package does not belong to this provider', 'PLAN_NETWORK_MISMATCH');
  if ((plan.metadata as Record<string, unknown> | undefined)?.kind !== 'PACKAGE') {
    throw AppError.badRequest('Invalid cable package', 'INVALID_PLAN');
  }
  const pricing = await getSetting('pricing');
  const provider = getVtuProvider();
  const requestHash = hashRequestPayload({
    service: 'CABLE',
    cableProvider,
    smartcardNumber,
    providerPlanId: input.providerPlanId,
    version: 1,
  });
  const existing = await findExisting(actor.userId, input.idempotencyKey, requestHash);
  if (existing) return { ...existing.serialized, duplicate: true };

  const validation = await provider.validateSmartcard({ provider: cableProvider, smartcardNumber });
  if (!validation.valid) {
    throw AppError.badRequest(validation.message ?? 'Smartcard could not be validated', 'INVALID_SMARTCARD');
  }

  const fee = pricing.cableFeeMinor;
  return createPurchase(
    actor,
    {
      service: 'CABLE',
      amountMinor: plan.sellingPriceMinor,
      payableMinor: plan.sellingPriceMinor + fee,
      feeMinor: fee,
      discountMinor: 0,
      costMinor: plan.costMinor,
      marginMinor: plan.sellingPriceMinor - plan.costMinor + fee,
      providerRequest: {
        reference: '',
        service: 'CABLE',
        cableProvider,
        smartcardNumber,
        packageCode: plan.providerPlanId,
        planCode: plan.providerPlanId,
      },
      recipient: {
        smartcardNumber,
        cableProvider,
        customerName: validation.customerName,
      },
      plan: {
        code: plan.providerPlanId,
        name: plan.name,
        validity: plan.validity ?? undefined,
      },
      fulfillment: {
        customerName: validation.customerName ?? null,
        token: null,
        units: null,
      },
      requestHash,
      description: `${plan.name} subscription for ${cableProvider} ${smartcardNumber}`,
      isSandbox: provider.isSandbox || plan.isSandbox,
    },
    input.idempotencyKey
  );
}

export async function getTransaction(actor: Actor, reference: string) {
  const filter: FilterQuery<unknown> = { reference };
  if (actor.role === 'CUSTOMER' || actor.role === 'SUPPORT') {
    filter.userId = actor.userId;
  }
  const transaction = await selectWithToken(Transaction.findOne(filter));
  if (!transaction) throw AppError.notFound('Transaction not found');
  return serialise(transaction, actor.role === 'ADMIN');
}

export async function listTransactions(
  actor: Actor,
  options: {
    page: number;
    limit: number;
    service?: string;
    status?: string;
    search?: string;
    from?: string;
    to?: string;
    userId?: string;
    provider?: string;
  }
) {
  const filter: FilterQuery<unknown> = actor.role === 'ADMIN' ? {} : { userId: actor.userId };
  if (actor.role === 'ADMIN' && options.userId) {
    if (!Types.ObjectId.isValid(options.userId)) throw AppError.badRequest('Invalid user id');
    filter.userId = options.userId;
  }
  if (options.provider) filter.provider = options.provider;
  if (options.service) filter.service = options.service;
  if (options.status) filter.status = options.status;
  if (options.from || options.to) {
    filter.createdAt = {
      ...(options.from ? { $gte: new Date(options.from) } : {}),
      ...(options.to ? { $lte: new Date(options.to) } : {}),
    };
  }
  if (options.search) {
    const safe = options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { reference: { $regex: safe, $options: 'i' } },
      { 'recipient.phone': { $regex: safe } },
      { 'recipient.meterNumber': { $regex: safe } },
      { 'recipient.smartcardNumber': { $regex: safe } },
      { providerReference: { $regex: safe, $options: 'i' } },
    ];
  }

  const [transactions, total] = await Promise.all([
    selectWithToken(Transaction.find(filter))
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit),
    Transaction.countDocuments(filter),
  ]);
  return {
    transactions: transactions.map((t) => serialise(t, actor.role === 'ADMIN')),
    pagination: paginationMeta(total, options.page, options.limit),
  };
}

export async function approveHeldTransaction(actor: Actor, reference: string) {
  const transaction = await Transaction.findOne({ reference });
  if (!transaction) throw AppError.notFound('Transaction not found');
  if (transaction.status !== 'REQUIRES_REVIEW' || transaction.providerSubmittedAt) {
    throw AppError.conflict(
      'Only purchases held before provider submission can be approved. Use "check provider status" for uncertain outcomes.',
      'REVIEW_NOT_APPROVABLE'
    );
  }
  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'PURCHASE_REVIEW_APPROVED',
    entityType: 'Transaction',
    entityId: String(transaction._id),
    metadata: { reference, heldAmountMinor: transaction.payableMinor },
    req: actor.req,
  });
  const result = await submitToProvider(String(transaction.userId), String(transaction._id));
  return serialise(result, true);
}

export async function rejectHeldTransaction(actor: Actor, reference: string, reason: string) {
  const transaction = await Transaction.findOne({ reference });
  if (!transaction) throw AppError.notFound('Transaction not found');
  if (transaction.status !== 'REQUIRES_REVIEW' || transaction.providerSubmittedAt) {
    throw AppError.conflict('Only purchases held before provider submission can be rejected', 'REVIEW_NOT_REJECTABLE');
  }
  const failed = await transitionTransaction(String(transaction._id), 'FAILED', {
    reason: `Manual review rejected: ${reason}`,
    actorId: actor.userId,
    set: { failureReason: reason, reviewReason: reason, nextReconcileAt: null },
  });
  await refundTransaction(String(transaction._id), `Manual review rejected: ${reason}`);
  await notify({
    userId: String(transaction.userId),
    type: 'REFUND',
    title: 'Purchase rejected — refunded',
    body: `Your purchase ${transaction.reference} was not approved. ${formatNaira(transaction.payableMinor)} was returned to your wallet.`,
    link: `/dashboard/transactions/${transaction.reference}`,
  });
  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'PURCHASE_REVIEW_REJECTED',
    entityType: 'Transaction',
    entityId: String(transaction._id),
    metadata: { reference, reason },
    req: actor.req,
  });
  return serialise(failed.transaction, true);
}

export async function checkProviderStatus(actor: Actor, reference: string) {
  const transaction = await Transaction.findOne({ reference });
  if (!transaction) throw AppError.notFound('Transaction not found');
  if (['SUCCESSFUL', 'FAILED', 'REFUNDED', 'REVERSED'].includes(transaction.status)) {
    return serialise(transaction, true);
  }
  if (!transaction.providerSubmittedAt) {
    throw AppError.conflict('This transaction was never submitted to the provider. Approve or reject the review instead.', 'NOT_SUBMITTED');
  }
  const provider = getVtuProvider();
  let result: ProviderStatusResult;
  try {
    result = await provider.queryStatus(transaction.reference);
  } catch (error) {
    throw AppError.serviceUnavailable('Provider status check failed. Try again later.', 'STATUS_CHECK_FAILED');
  }
  await Transaction.updateOne(
    { _id: transaction._id },
    { $inc: { reconciliationAttempts: 1 }, $set: { reconciledAt: new Date() } }
  );
  const updated = await applyProviderOutcome(String(transaction.userId), String(transaction._id), result, 'admin');
  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'PROVIDER_STATUS_CHECKED',
    entityType: 'Transaction',
    entityId: String(transaction._id),
    metadata: { reference, outcome: result.outcome },
    req: actor.req,
  });
  return serialise(updated, true);
}

export async function getDashboardSummary(userId: string) {
  const provider = getVtuProvider();
  const [wallet, recent, counts, monthly] = await Promise.all([
    import('./walletService').then((m) => m.getWallet(userId)),
    selectWithToken(Transaction.find({ userId }).sort({ createdAt: -1 }).limit(5)),
    Transaction.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          status: 'SUCCESSFUL',
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          amountMinor: { $sum: '$payableMinor' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const statusMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  return {
    wallet,
    recentTransactions: recent.map((t) => serialise(t)),
    statusCounts: {
      successful: statusMap.SUCCESSFUL ?? 0,
      pending: (statusMap.PENDING ?? 0) + (statusMap.PROCESSING ?? 0) + (statusMap.REQUIRES_REVIEW ?? 0),
      failed: (statusMap.FAILED ?? 0) + (statusMap.REFUNDED ?? 0),
    },
    monthlyActivity: monthly.map((m) => ({ date: m._id, amountMinor: m.amountMinor })),
    provider: { isSandbox: provider.isSandbox, key: provider.key },
  };
}

export { serialise as serialiseTransaction };
