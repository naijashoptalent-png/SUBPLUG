import { NextFunction, Request, Response } from 'express';
import { Role } from '../config/constants';
import { AppError } from '../utils/AppError';

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to access this resource', 'INSUFFICIENT_ROLE'));
    }
    next();
  };
}
