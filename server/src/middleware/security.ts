import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import { Express } from 'express';
import { corsOrigins, isProduction } from '../config/env';
import { AppError } from '../utils/AppError';

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) return callback(null, true);
    return callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'This origin is not allowed to access the API'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy'],
  maxAge: 600,
};

export function applySecurity(app: Express): void {
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false, // API serves JSON; CSP is configured on the static frontend
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    })
  );
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(hpp());
  app.use(compression());
}
