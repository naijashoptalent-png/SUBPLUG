import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { handlePaymentWebhook } from '../services/fundingService';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import type { PaymentGatewayKey } from '../config/paymentGateways';

function paymentWebhook(gateway: PaymentGatewayKey, signatureHeader: string) {
  return asyncHandler(async (req: Request, res: Response) => {
    if (!req.rawBody) {
      throw AppError.badRequest('Raw body unavailable for signature verification', 'RAW_BODY_MISSING');
    }
    const result = await handlePaymentWebhook(gateway, req.rawBody, req.get(signatureHeader));
    // Always acknowledge signed events quickly; internal failures are recorded for reconciliation.
    res.status(200).json({ ...result, received: true });
  });
}

export const paystackWebhook = paymentWebhook('paystack', 'x-paystack-signature');
export const flutterwaveWebhook = paymentWebhook('flutterwave', 'verif-hash');

export const markSandboxPayment = asyncHandler(async (req: Request, _res: Response) => {
  // Sandbox helper is not a webhook; handled via authenticated dev routes.
  logger.warn({ ip: req.ip }, 'Sandbox webhook endpoint called');
  throw AppError.notFound('Sandbox webhooks are not supported. Use the sandbox checkout.');
});
