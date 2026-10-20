import express from 'express';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { applySecurity } from './middleware/security';
import { requestId } from './middleware/requestId';
import { sanitizeRequest } from './middleware/sanitize';
import { csrfProtection } from './middleware/csrf';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import apiRoutes from './routes';
import { health, readiness } from './controllers/systemController';
import { logger } from './config/logger';

export function createApp() {
  const app = express();

  const trust = process.env.TRUST_PROXY ?? '1';
  if (trust === 'false' || trust === '0') app.set('trust proxy', false);
  else if (trust === 'true') app.set('trust proxy', true);
  else app.set('trust proxy', Number(trust) || 1);

  applySecurity(app);
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId ?? 'unknown',
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/health/live',
      },
      customProps: (req) => ({
        requestId: (req as express.Request).requestId,
        userId: (req as express.Request).user?.id,
      }),
      serializers: {
        req(req: express.Request & { raw?: { method?: string; url?: string } }) {
          return { method: req.method, url: req.url };
        },
        res(res: express.Response) {
          return { statusCode: res.statusCode };
        },
      },
    })
  );
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = Buffer.from(buf);
      },
    })
  );
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitizeRequest);
  app.use(csrfProtection);

  app.get('/health', health);
  app.get('/health/live', (_req, res) => res.json({ data: { status: 'alive' } }));
  app.get('/health/ready', readiness);

  app.use('/api', globalLimiter);
  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
