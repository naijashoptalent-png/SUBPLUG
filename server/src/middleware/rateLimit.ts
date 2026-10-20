import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env';
import { Request, Response } from 'express';

function jsonHandler(_req: Request, res: Response) {
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait a moment and try again.',
    },
    requestId: (_req as Request).requestId,
  });
}

export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: isTest ? 100000 : env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => jsonHandler(req, res),
  skip: (req) => req.originalUrl.startsWith('/api/v1/webhooks/'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 100000 : env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => jsonHandler(req, res),
  skipSuccessfulRequests: true,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isTest ? 100000 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => jsonHandler(req, res),
});

export const financialLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: isTest ? 100000 : 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
  handler: (req, res) => jsonHandler(req, res),
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isTest ? 100000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => jsonHandler(req, res),
});

export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isTest ? 100000 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => jsonHandler(req, res),
});
