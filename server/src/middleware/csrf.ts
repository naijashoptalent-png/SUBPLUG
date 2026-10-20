import { NextFunction, Request, Response } from 'express';
import { COOKIES } from '../config/constants';
import { safeEqual } from '../utils/crypto';
import { AppError } from '../utils/AppError';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = ['/api/v1/webhooks/', '/api/v1/auth/csrf', '/health'];

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (EXEMPT_PATHS.some((path) => req.originalUrl.startsWith(path))) return next();

  const cookieToken = req.cookies?.[COOKIES.csrf];
  const headerToken = req.get('x-csrf-token');

  if (!cookieToken || !headerToken || !safeEqual(String(cookieToken), String(headerToken))) {
    return next(
      new AppError(
        403,
        'CSRF_VALIDATION_FAILED',
        'Security token missing or invalid. Refresh the page and try again.'
      )
    );
  }
  next();
}
