import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as catalogueService from '../services/catalogueService';
import { getPublicSettings, getSetting } from '../services/settingsService';
import { getVtuProvider, getVtuProviderForService } from '../providers';
import { env } from '../config/env';
import { listAvailablePaymentMethods } from '../providers/paymentIndex';
import { AppError } from '../utils/AppError';
import { sendContactMessage } from '../services/emailService';
import { writeAudit } from '../services/auditService';
import { sanitiseCustomerCopy } from '../utils/customerCopy';

export const listServices = asyncHandler(async (_req: Request, res: Response) => {
  const services = await catalogueService.listServices();
  const vtu = getVtuProvider();
  // Provider identity is deliberately omitted from the customer-facing payload.
  res.json({ data: { services, provider: { isSandbox: vtu.isSandbox } } });
});

export const getNetworks = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: await catalogueService.getNetworks() });
});

export const getDataPlans = asyncHandler(async (req: Request, res: Response) => {
  const network = typeof req.query.network === 'string' ? req.query.network : undefined;
  res.json({ data: await catalogueService.listDataPlans(network) });
});

export const getElectricityProviders = asyncHandler(async (_req: Request, res: Response) => {
  const pricing = await getSetting('pricing');
  res.json({ data: { providers: await catalogueService.listElectricityProviders(), feeMinor: pricing.electricityFeeMinor } });
});

export const getCableProviders = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: await catalogueService.listCableProviders() });
});

export const getCablePackages = asyncHandler(async (req: Request, res: Response) => {
  const network = String(req.query.network ?? '');
  if (!network) throw AppError.badRequest('network query parameter is required');
  res.json({ data: await catalogueService.listCablePackages(network) });
});

export const quoteAirtime = asyncHandler(async (req: Request, res: Response) => {
  const network = String(req.query.network ?? '');
  const amountMinor = Number(req.query.amountMinor ?? 0);
  const quote = await catalogueService.quoteAirtime(network, amountMinor);
  res.json({ data: quote });
});

export const validateMeter = asyncHandler(async (req: Request, res: Response) => {
  const provider = getVtuProviderForService('ELECTRICITY');
  const result = await provider.validateMeter({
    disco: req.body.disco,
    meterNumber: req.body.meterNumber,
    meterType: req.body.meterType,
  });
  res.json({ data: { ...result, message: sanitiseCustomerCopy(result.message) ?? undefined } });
});

export const validateSmartcard = asyncHandler(async (req: Request, res: Response) => {
  const provider = getVtuProviderForService('CABLE');
  const result = await provider.validateSmartcard({
    provider: req.body.cableProvider,
    smartcardNumber: req.body.smartcardNumber,
  });
  res.json({ data: { ...result, message: sanitiseCustomerCopy(result.message) ?? undefined } });
});

export const publicSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getPublicSettings();
  const paymentMethods = listAvailablePaymentMethods();
  const defaultMethod = paymentMethods.find((method) => method.key === env.PAYMENT_GATEWAY) ?? paymentMethods[0];
  const vtu = getVtuProvider();
  res.json({
    data: {
      ...settings,
      environment: {
        vtuSandbox: vtu.isSandbox,
        // If any offered method is a sandbox, the UI must warn that test funds
        // are possible even when another method is live.
        paymentSandbox: paymentMethods.some((method) => method.isSandbox),
        paymentGateway: defaultMethod?.key ?? 'unconfigured',
        paymentMethods,
      },
    },
  });
});

export const contact = asyncHandler(async (req: Request, res: Response) => {
  await sendContactMessage(req.body);
  await writeAudit({
    action: 'PUBLIC_CONTACT_SUBMITTED',
    entityType: 'Support',
    metadata: { subject: req.body.subject },
  });
  res.json({
    data: {
      message: 'Thanks — your message was received. Support will respond using the email address you provided.',
    },
  });
});
