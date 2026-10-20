import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import { isProduction } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong. Please try again.';
  let details: unknown;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.issues[0]?.message ?? 'Invalid request';
    details = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = Object.values(error.errors)[0]?.message ?? 'Invalid data';
    details = Object.values(error.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (error instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = 'Invalid identifier format';
  } else if (error && typeof error === 'object' && (error as { code?: number }).code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'A record with these details already exists';
  }

  if (statusCode >= 500) {
    logger.error(
      {
        err: error,
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.id,
      },
      'Unhandled request error'
    );
  } else {
    logger.warn(
      { code, requestId: req.requestId, method: req.method, path: req.path, statusCode },
      'Request rejected'
    );
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(!isProduction && statusCode >= 500 && error instanceof Error ? { debug: error.message } : {}),
    },
    requestId: req.requestId,
  });
}
