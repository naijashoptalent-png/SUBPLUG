import { Request } from 'express';
import { WalletFunding, PaymentEvent, User } from '../models';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { generateReference } from '../utils/reference';
import { hashRequestPayload } from '../utils/crypto';
import { sanitizeProviderPayload } from '../utils/redact';
import { getPaymentProvider, isPaymentGatewayEnabled } from '../providers/paymentIndex';
import { PaymentVerificationResult } from '../providers/paymentTypes';
import { creditWallet } from './walletService';
import { getSetting } from './settingsService';
import { notify } from './notificationService';
import { sendFundingReceipt } from './emailService';
import { writeAudit } from './auditService';
import { paginationMeta } from '../utils/pagination';
import { formatNaira } from '../utils/money';

function gatewayForFunding(funding: { gateway: string }) {
  return getPaymentProvider(funding.gateway);
}

export async function initializeFunding(input: {
  userId: string;
  amountMinor: number;
  idempotencyKey: string;
  gateway?: string;
  req: Request;
}) {
  const [limits] = await Promise.all([getSetting('limits')]);
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < limits.fundingMinMinor || input.amountMinor > limits.fundingMaxMinor) {
    throw AppError.badRequest(
      `Funding amount must be between ${formatNaira(limits.fundingMinMinor)} and ${formatNaira(limits.fundingMaxMinor)}`,
      'AMOUNT_OUT_OF_RANGE'
    );
  }

  const user = await User.findById(input.userId);
  if (!user) throw AppError.notFound('User not found');
  if (user.status !== 'ACTIVE') throw AppError.forbidden('Account is not active', 'ACCOUNT_INACTIVE');

  // The gateway is part of the request hash: reusing a key with another
  // payment method is a different request, not an idempotent replay.
  const gatewayKey = input.gateway ?? env.PAYMENT_GATEWAY;
  const requestHash = hashRequestPayload({ amountMinor: input.amountMinor, gateway: gatewayKey });
  const existing = await WalletFunding.findOne({ userId: input.userId, idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw AppError.conflict('Idempotency key was reused with different payment details', 'IDEMPOTENCY_MISMATCH');
    }
    return {
      reference: existing.reference,
      amountMinor: existing.amountMinor,
      status: existing.status,
      authorizationUrl: existing.authorizationUrl,
      gateway: existing.gateway,
      isSandbox: existing.isSandbox,
      duplicate: true,
    };
  }

  if (!isPaymentGatewayEnabled(gatewayKey)) {
    throw AppError.badRequest('That payment method is not available.', 'PAYMENT_GATEWAY_UNAVAILABLE');
  }
  const provider = getPaymentProvider(gatewayKey);
  const reference = generateReference('FUND');
  const funding = await WalletFunding.create({
    reference,
    userId: input.userId,
    amountMinor: input.amountMinor,
    status: 'PENDING',
    gateway: provider.key,
    idempotencyKey: input.idempotencyKey,
    requestHash,
    isSandbox: provider.isSandbox,
  });

  try {
    const initialized = await provider.initialize({
      reference,
      email: user.email,
      amountMinor: input.amountMinor,
      currency: env.PAYMENT_CURRENCY,
      callbackUrl: `${env.CLIENT_URL}/wallet/funding/callback`,
      metadata: { userId: String(user._id), fundingReference: reference },
    });
    funding.authorizationUrl = initialized.authorizationUrl;
    funding.gatewayReference = initialized.gatewayReference;
    if (initialized.accessCode) funding.accessCode = initialized.accessCode;
    funding.isSandbox = initialized.isSandbox;
    await funding.save();

    await writeAudit({
      actorId: input.userId,
      actorRole: user.role,
      action: 'WALLET_FUNDING_INITIALIZED',
      entityType: 'WalletFunding',
      entityId: String(funding._id),
      metadata: { reference, amountMinor: input.amountMinor, gateway: provider.key, sandbox: initialized.isSandbox },
      req: input.req,
    });

    return {
      reference,
      amountMinor: funding.amountMinor,
      status: funding.status,
      authorizationUrl: initialized.authorizationUrl,
      gateway: provider.key,
      isSandbox: initialized.isSandbox,
      duplicate: false,
    };
  } catch (error) {
    funding.status = 'FAILED';
    funding.failureReason = error instanceof Error ? error.message.slice(0, 500) : 'Initialization failed';
    await funding.save();
    throw error;
  }
}

export async function getFunding(userId: string, reference: string) {
  const funding = await WalletFunding.findOne({ userId, reference }).lean();
  if (!funding) throw AppError.notFound('Funding record not found');
  return {
    reference: funding.reference,
    amountMinor: funding.amountMinor,
    currency: funding.currency,
    status: funding.status,
    gateway: funding.gateway,
    isSandbox: funding.isSandbox,
    authorizationUrl: funding.authorizationUrl,
    paidAt: funding.paidAt,
    creditedAt: funding.creditedAt,
    failureReason: funding.failureReason,
    reviewReason: funding.reviewReason,
    createdAt: funding.createdAt,
  };
}

export async function listFundings(userId: string, page: number, limit: number) {
  const [fundings, total] = await Promise.all([
    WalletFunding.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    WalletFunding.countDocuments({ userId }),
  ]);
  return {
    fundings: fundings.map((f) => ({
      reference: f.reference,
      amountMinor: f.amountMinor,
      status: f.status,
      gateway: f.gateway,
      isSandbox: f.isSandbox,
      createdAt: f.createdAt,
      paidAt: f.paidAt,
    })),
    pagination: paginationMeta(total, page, limit),
  };
}

async function markReview(fundingId: string, reason: string) {
  await WalletFunding.updateOne(
    { _id: fundingId },
    { $set: { status: 'REQUIRES_REVIEW', reviewReason: reason, verifiedAt: new Date() } }
  );
  logger.error({ fundingId, reason }, 'Funding requires manual review');
}

/**
 * Credits the wallet only after a verified gateway result that matches the
 * expected reference, amount, and currency. Idempotent at the ledger level.
 */
export async function confirmFunding(
  fundingReference: string,
  verification: PaymentVerificationResult,
  source: 'webhook' | 'callback' | 'reconciliation' | 'admin'
) {
  const funding = await WalletFunding.findOne({ reference: fundingReference });
  if (!funding) throw AppError.notFound('Funding record not found');

  if (funding.status === 'SUCCESSFUL') {
    return { status: 'SUCCESSFUL' as const, reference: funding.reference, alreadyProcessed: true };
  }
  if (funding.status === 'REQUIRES_REVIEW') {
    return {
      status: 'REQUIRES_REVIEW' as const,
      reference: funding.reference,
      message: funding.reviewReason ?? 'This payment is under manual review.',
    };
  }

  if (verification.outcome === 'PENDING' || verification.outcome === 'UNCERTAIN') {
    await WalletFunding.updateOne(
      { _id: funding._id, status: { $nin: ['SUCCESSFUL', 'REQUIRES_REVIEW'] } },
      { $set: { verifiedAt: new Date() } }
    );
    return {
      status: 'PENDING' as const,
      reference: funding.reference,
      message: verification.message ?? 'Payment has not been confirmed by the gateway yet.',
    };
  }

  if (verification.outcome === 'FAILED') {
    await WalletFunding.updateOne(
      { _id: funding._id, status: { $ne: 'SUCCESSFUL' } },
      {
        $set: {
          status: 'FAILED',
          verifiedAt: new Date(),
          failureReason: (verification.message ?? 'Payment failed at gateway').slice(0, 500),
          gatewayPayload: sanitizeProviderPayload(verification.raw) as Record<string, unknown>,
        },
      }
    );
    return { status: 'FAILED' as const, reference: funding.reference, message: verification.message };
  }

  // Outcome is SUCCESSFUL. Validate everything before touching the ledger.
  const amountMatches = verification.amountMinor === funding.amountMinor;
  const currencyMatches = (verification.currency ?? env.PAYMENT_CURRENCY) === funding.currency;
  const referenceMatches = !verification.gatewayReference || verification.gatewayReference === funding.reference;

  if (!amountMatches || !currencyMatches || !referenceMatches) {
    await markReview(
      String(funding._id),
      `Gateway mismatch: expected ${funding.amountMinor} ${funding.currency} / ${funding.reference}; got ${verification.amountMinor} ${verification.currency} / ${verification.gatewayReference}`
    );
    await writeAudit({
      action: 'FUNDING_REVIEW_REQUIRED',
      entityType: 'WalletFunding',
      entityId: String(funding._id),
      metadata: { source, reason: 'amount/currency/reference mismatch' },
    });
    return {
      status: 'REQUIRES_REVIEW' as const,
      reference: funding.reference,
      message: 'Payment details did not match. Support will review this payment.',
    };
  }

  const user = await User.findById(funding.userId).lean();
  if (!user) throw AppError.notFound('User not found');

  await creditWallet({
    userId: String(funding.userId),
    amountMinor: funding.amountMinor,
    type: 'FUNDING_CREDIT',
    idempotencyKey: `funding-credit:${String(funding._id)}`,
    description: `Wallet funding ${funding.reference}`,
    fundingId: String(funding._id),
    metadata: { gateway: funding.gateway, source },
  });

  await WalletFunding.updateOne(
    { _id: funding._id, status: { $ne: 'SUCCESSFUL' } },
    {
      $set: {
        status: 'SUCCESSFUL',
        paidAt: verification.paidAt ?? new Date(),
        verifiedAt: new Date(),
        creditedAt: new Date(),
        gatewayReference: verification.gatewayReference ?? funding.gatewayReference,
        gatewayPayload: sanitizeProviderPayload(verification.raw) as Record<string, unknown>,
      },
    }
  );

  await notify({
    userId: String(funding.userId),
    type: 'FUNDING',
    title: 'Wallet funded',
    body: `${formatNaira(funding.amountMinor)} was added to your wallet. Reference: ${funding.reference}`,
    link: `/dashboard/wallet`,
    metadata: { reference: funding.reference, amountMinor: funding.amountMinor },
  });
  if (env.TRANSACTION_EMAIL_ALERTS) {
    await sendFundingReceipt(user.email, funding.reference, funding.amountMinor);
  }
  await writeAudit({
    actorId: String(funding.userId),
    actorRole: user.role,
    action: 'WALLET_FUNDED',
    entityType: 'WalletFunding',
    entityId: String(funding._id),
    metadata: { source, amountMinor: funding.amountMinor, reference: funding.reference },
  });

  return {
    status: 'SUCCESSFUL' as const,
    reference: funding.reference,
    amountMinor: funding.amountMinor,
    alreadyProcessed: false,
  };
}

export async function verifyFundingWithGateway(
  userId: string,
  reference: string,
  source: 'callback' | 'reconciliation' = 'callback'
) {
  const funding = await WalletFunding.findOne({ userId, reference });
  if (!funding) throw AppError.notFound('Funding record not found');
  if (funding.status === 'SUCCESSFUL') {
    return { status: 'SUCCESSFUL' as const, reference, alreadyProcessed: true };
  }
  const provider = gatewayForFunding(funding);
  const verification = await provider.verify(reference);
  return confirmFunding(reference, verification, source);
}

export async function handlePaymentWebhook(
  gatewayKey: string,
  rawBody: Buffer,
  signature: string | undefined
) {
  const provider = getPaymentProvider(gatewayKey);
  const validation = provider.parseWebhook(rawBody, signature);
  if (!validation.valid) {
    await writeAudit({
      action: 'WEBHOOK_SIGNATURE_INVALID',
      entityType: 'PaymentEvent',
      entityId: validation.eventId,
      metadata: { gateway: provider.key, eventType: validation.eventType },
    });
    throw AppError.unauthorized('Invalid webhook signature', 'INVALID_SIGNATURE');
  }

  let event;
  try {
    event = await PaymentEvent.create({
      gateway: provider.key,
      eventId: validation.eventId,
      eventType: validation.eventType,
      reference: validation.reference,
      signatureVerified: true,
      payload: sanitizeProviderPayload(validation.payload) as Record<string, unknown>,
      processed: false,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return { received: true, duplicate: true };
    }
    throw error;
  }

  if (!provider.paymentEventTypes.includes(validation.eventType)) {
    await PaymentEvent.updateOne(
      { _id: event._id },
      { $set: { processed: true, processedAt: new Date(), processingError: 'Ignored event type' } }
    );
    return { received: true, ignored: true };
  }

  if (!validation.reference) {
    await PaymentEvent.updateOne(
      { _id: event._id },
      { $set: { processed: false, processingError: 'Missing reference' } }
    );
    return { received: true, pending: true };
  }

  const funding = await WalletFunding.findOne({ reference: validation.reference }).lean();
  if (!funding) {
    await PaymentEvent.updateOne(
      { _id: event._id },
      { $set: { processed: true, processedAt: new Date(), processingError: 'Funding record not found' } }
    );
    logger.warn({ gateway: provider.key, reference: validation.reference }, 'Webhook references an unknown funding');
    return { received: true, ignored: true };
  }
  // Never let one gateway confirm a funding created by another gateway.
  if (funding.gateway !== provider.key) {
    await PaymentEvent.updateOne(
      { _id: event._id },
      {
        $set: {
          processed: true,
          processedAt: new Date(),
          processingError: `Gateway mismatch: funding uses ${funding.gateway}`,
        },
      }
    );
    await writeAudit({
      action: 'WEBHOOK_GATEWAY_MISMATCH',
      entityType: 'WalletFunding',
      entityId: String(funding._id),
      metadata: { gateway: provider.key, fundingGateway: funding.gateway, reference: funding.reference },
    });
    logger.error(
      { gateway: provider.key, fundingGateway: funding.gateway, reference: funding.reference },
      'Webhook gateway does not match the funding record'
    );
    return { received: true, ignored: true };
  }

  try {
    const verification = await provider.verify(validation.reference);
    const result = await confirmFunding(validation.reference, verification, 'webhook');
    const fullyProcessed = result.status === 'SUCCESSFUL' || result.status === 'FAILED' || result.status === 'REQUIRES_REVIEW';
    await PaymentEvent.updateOne(
      { _id: event._id },
      {
        $set: {
          processed: fullyProcessed,
          processedAt: fullyProcessed ? new Date() : null,
          processingError: fullyProcessed ? null : `Outcome: ${result.status}`,
        },
      }
    );
    return { received: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Webhook processing failed';
    await PaymentEvent.updateOne(
      { _id: event._id },
      { $set: { processed: false, processingError: message } }
    );
    logger.error({ err: error, reference: validation.reference }, 'Webhook processing failed');
    return { received: true, pending: true };
  }
}

export async function reconcilePendingFundings(limit = 25) {
  const pending = await WalletFunding.find({
    status: 'PENDING',
    createdAt: { $lte: new Date(Date.now() - 2 * 60 * 1000) },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  let checked = 0;
  let credited = 0;
  for (const funding of pending) {
    checked += 1;
    try {
      const provider = gatewayForFunding(funding);
      const verification = await provider.verify(funding.reference);
      const result = await confirmFunding(funding.reference, verification, 'reconciliation');
      if (result.status === 'SUCCESSFUL') credited += 1;
    } catch (error) {
      logger.warn({ err: error, reference: funding.reference }, 'Pending funding reconciliation failed');
    }
  }
  return { checked, credited };
}

/** Re-checks a funding with the gateway. Never credits without a verified match. */
export async function checkAndConfirmFunding(reference: string) {
  const funding = await WalletFunding.findOne({ reference });
  if (!funding) throw AppError.notFound('Funding record not found');
  const provider = gatewayForFunding(funding);
  const verification = await provider.verify(reference);
  return confirmFunding(reference, verification, 'admin');
}

/** Development-only: marks the sandbox payment and runs the real verification path. */
export async function simulateSandboxPayment(userId: string, reference: string, outcome: 'success' | 'failed' = 'success') {
  if (env.NODE_ENV === 'production' || !env.ALLOW_MOCK_PAYMENTS) {
    throw AppError.forbidden('Sandbox payment simulation is disabled', 'SANDBOX_DISABLED');
  }
  const funding = await WalletFunding.findOne({ reference, userId, isSandbox: true });
  if (!funding) throw AppError.notFound('Sandbox funding record not found');
  const provider = gatewayForFunding(funding);
  if (provider.key !== 'mock') throw AppError.forbidden('Sandbox simulation only works with the mock gateway', 'NOT_SANDBOX');
  const mock = provider as unknown as {
    markPaid: (ref: string) => boolean;
    markFailed: (ref: string) => boolean;
  };
  const marked = outcome === 'failed' ? mock.markFailed(reference) : mock.markPaid(reference);
  if (!marked) {
    throw AppError.conflict(
      'Sandbox payment is not available in memory (server may have restarted). Start a new funding request.',
      'SANDBOX_SESSION_LOST'
    );
  }
  const verification = await provider.verify(reference);
  return confirmFunding(reference, verification, 'callback');
}
