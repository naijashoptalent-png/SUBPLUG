import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as walletService from '../services/walletService';
import * as fundingService from '../services/fundingService';
import { requireIdempotencyKey } from '../middleware/validate';
import { AppError } from '../utils/AppError';

export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  const overview = await walletService.getWalletOverview(req.user!.id);
  res.json({ data: overview });
});

export const getLedger = asyncHandler(async (req: Request, res: Response) => {
  const result = await walletService.listLedger(req.user!.id, {
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    type: req.query.type as string | undefined,
    direction: req.query.direction as string | undefined,
  });
  res.json({ data: result });
});

export const fundWallet = asyncHandler(async (req: Request, res: Response) => {
  const idempotencyKey = requireIdempotencyKey(req);
  const result = await fundingService.initializeFunding({
    userId: req.user!.id,
    amountMinor: req.body.amountMinor,
    gateway: req.body.gateway,
    idempotencyKey,
    req,
  });
  res.status(201).json({ data: result });
});

export const listFundings = asyncHandler(async (req: Request, res: Response) => {
  const result = await fundingService.listFundings(
    req.user!.id,
    Number(req.query.page ?? 1),
    Number(req.query.limit ?? 20)
  );
  res.json({ data: result });
});

export const getFunding = asyncHandler(async (req: Request, res: Response) => {
  const result = await fundingService.getFunding(req.user!.id, req.params.reference);
  res.json({ data: result });
});

export const verifyFunding = asyncHandler(async (req: Request, res: Response) => {
  const result = await fundingService.verifyFundingWithGateway(req.user!.id, req.params.reference);
  res.json({ data: result });
});

export const simulateSandboxFunding = asyncHandler(async (req: Request, res: Response) => {
  const outcome = req.body?.outcome;
  if (!outcome || !['success', 'failed'].includes(outcome)) {
    throw AppError.badRequest('Outcome must be "success" or "failed"', 'INVALID_OUTCOME');
  }
  const result = await fundingService.simulateSandboxPayment(req.user!.id, req.params.reference, outcome);
  res.json({ data: result });
});
