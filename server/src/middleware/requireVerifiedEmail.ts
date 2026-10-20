import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { getSetting } from '../services/settingsService';

export async function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    if (req.user.role === 'ADMIN' || req.user.role === 'SUPPORT') return next();
    const registration = await getSetting('registration');
    if (registration.requireEmailVerification && !req.user.emailVerifiedAt) {
      throw new AppError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Verify your email address before making purchases or funding your wallet.'
      );
    }
    next();
  } catch (error) {
    next(error);
  }
}
