import { NextFunction, Request, Response } from 'express';
import { COOKIES } from '../config/constants';
import { verifyAccessToken } from '../services/tokenService';
import { User } from '../models';
import { AppError } from '../utils/AppError';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const bearer = req.get('authorization');
    const token =
      req.cookies?.[COOKIES.access] ||
      (bearer?.startsWith('Bearer ') ? bearer.slice(7).trim() : undefined);

    if (!token) throw AppError.unauthorized('Sign in to continue', 'UNAUTHENTICATED');

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user) throw AppError.unauthorized('Account no longer exists', 'ACCOUNT_NOT_FOUND');
    if (user.status === 'SUSPENDED') {
      throw AppError.forbidden(user.suspensionReason ?? 'Account suspended', 'ACCOUNT_SUSPENDED');
    }
    if (user.status !== 'ACTIVE') throw AppError.forbidden('Account is not active', 'ACCOUNT_INACTIVE');

    req.user = {
      id: String(user._id),
      name: user.fullName,
      email: user.email,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      status: user.status,
    };
    next();
  } catch (error) {
    next(error);
  }
}

/** For routes that can work with or without auth (public pages). */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const bearer = req.get('authorization');
  if (!req.cookies?.[COOKIES.access] && !bearer) return next();
  return authenticate(req, _res, next);
}
