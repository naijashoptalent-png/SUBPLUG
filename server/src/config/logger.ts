import pino from 'pino';
import { env, isProduction, isTest } from './env';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.confirmPassword',
      'req.body.token',
      'req.body.pin',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.refreshToken',
      '*.token',
      '*.secret',
      '*.apiKey',
      '*.authorization',
      '*.paystackSecret',
      '*.totpSecret',
    ],
    censor: '[REDACTED]',
  },
  base: { service: 'quicktopup-api', env: env.NODE_ENV },
  transport: !isProduction && !isTest
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
    : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
