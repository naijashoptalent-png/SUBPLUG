import { NextFunction, Request, Response } from 'express';

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/** Basic NoSQL/operator injection and prototype-pollution defence. Zod strips unknown fields too. */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 10) return undefined;
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key) || key.startsWith('$') || key.includes('.')) continue;
      output[key] = sanitize(val, depth + 1);
    }
    return output;
  }
  return value;
}

export function sanitizeRequest(req: Request, _res: Response, next: NextFunction): void {
  // Never mutate raw bytes needed for webhook signature checks.
  if (req.originalUrl.startsWith('/api/v1/webhooks/')) return next();
  if (req.body) req.body = sanitize(req.body);
  if (req.params) req.params = sanitize(req.params) as typeof req.params;
  if (req.query) req.query = sanitize(req.query) as typeof req.query;
  next();
}
