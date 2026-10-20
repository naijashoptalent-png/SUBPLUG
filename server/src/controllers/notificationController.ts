import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { Notification } from '../models';
import { paginationMeta } from '../utils/pagination';
import { AppError } from '../utils/AppError';
import { Types } from 'mongoose';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const [notifications, total, unread] = await Promise.all([
    Notification.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ userId: req.user!.id }),
    Notification.countDocuments({ userId: req.user!.id, readAt: null }),
  ]);
  res.json({ data: { notifications, unread, pagination: paginationMeta(total, page, limit) } });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  if (!Types.ObjectId.isValid(req.params.id)) throw AppError.badRequest('Invalid notification id');
  await Notification.updateOne(
    { _id: req.params.id, userId: req.user!.id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  res.json({ data: { success: true } });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await Notification.updateMany({ userId: req.user!.id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ data: { success: true } });
});
