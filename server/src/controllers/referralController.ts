import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getReferralSummary } from '../services/referralService';

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await getReferralSummary(req.user!.id) });
});
