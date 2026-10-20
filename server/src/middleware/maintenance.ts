import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { isMaintenanceMode } from '../services/settingsService';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Maintenance mode blocks customer financial operations while keeping login,
 * account verification, admin access, and signed webhooks operational.
 */
export async function maintenanceGuard(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!MUTATING.has(req.method)) return next();
    if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPPORT') return next();
    if (
      req.originalUrl.startsWith('/api/v1/webhooks/') ||
      req.originalUrl.startsWith('/api/v1/auth/') ||
      req.originalUrl.startsWith('/api/v1/contact')
    ) {
      return next();
    }
    if (await isMaintenanceMode()) {
      throw new AppError(
        503,
        'MAINTENANCE_MODE',
        'SubPlug is temporarily offline for maintenance. Please try again shortly.'
      );
    }
    next();
  } catch (error) {
    next(error);
  }
}
