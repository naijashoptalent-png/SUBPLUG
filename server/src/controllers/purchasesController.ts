import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireIdempotencyKey } from '../middleware/validate';
import * as purchaseService from '../services/purchaseService';

function actor(req: Request) {
  return { userId: req.user!.id, role: req.user!.role, req };
}

export const buyAirtime = asyncHandler(async (req: Request, res: Response) => {
  const result = await purchaseService.purchaseAirtime(actor(req), {
    ...req.body,
    idempotencyKey: requireIdempotencyKey(req),
  });
  res.status(201).json({ data: result });
});

export const buyData = asyncHandler(async (req: Request, res: Response) => {
  const result = await purchaseService.purchaseData(actor(req), {
    ...req.body,
    idempotencyKey: requireIdempotencyKey(req),
  });
  res.status(201).json({ data: result });
});

export const payElectricity = asyncHandler(async (req: Request, res: Response) => {
  const result = await purchaseService.purchaseElectricity(actor(req), {
    ...req.body,
    idempotencyKey: requireIdempotencyKey(req),
  });
  res.status(201).json({ data: result });
});

export const payCable = asyncHandler(async (req: Request, res: Response) => {
  const result = await purchaseService.purchaseCable(actor(req), {
    ...req.body,
    idempotencyKey: requireIdempotencyKey(req),
  });
  res.status(201).json({ data: result });
});

export const listPurchases = asyncHandler(async (req: Request, res: Response) => {
  const result = await purchaseService.listTransactions(actor(req), {
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    service: req.query.service as string | undefined,
    status: req.query.status as string | undefined,
    search: req.query.search as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  });
  res.json({ data: result });
});

export const getPurchase = asyncHandler(async (req: Request, res: Response) => {
  const result = await purchaseService.getTransaction(actor(req), req.params.reference);
  res.json({ data: result });
});

export const dashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await purchaseService.getDashboardSummary(req.user!.id) });
});
