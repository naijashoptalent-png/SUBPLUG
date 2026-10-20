import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        next(AppError.badRequest(details[0]?.message ?? 'Invalid request', 'VALIDATION_ERROR', details));
      } else {
        next(error);
      }
    }
  };
}

export function requireIdempotencyKey(req: Request): string {
  const key = req.get('idempotency-key');
  if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) {
    throw AppError.badRequest(
      'A valid Idempotency-Key header (8–100 letters, numbers, dash or underscore) is required for this operation',
      'IDEMPOTENCY_KEY_REQUIRED'
    );
  }
  return key;
}
