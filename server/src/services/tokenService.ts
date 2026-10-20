import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response } from 'express';
import { env, isProduction } from '../config/env';
import { COOKIES, Role } from '../config/constants';
import { sha256, randomToken } from '../utils/crypto';
import { Session, User } from '../models';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

const accessTtl = `${env.ACCESS_TOKEN_TTL_MINUTES}m`;
const refreshTtlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

interface AccessPayload {
  sub: string;
  role: Role;
  purpose: 'access';
}

export function signAccessToken(userId: string, role: Role): string {
  const payload: AccessPayload = { sub: userId, role, purpose: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: accessTtl,
    issuer: 'subplug',
    audience: 'subplug-api',
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'subplug',
      audience: 'subplug-api',
    }) as AccessPayload;
    if (decoded.purpose !== 'access') throw new Error('wrong token purpose');
    return decoded;
  } catch {
    throw AppError.unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
  }
}

export function signTwoFactorChallenge(userId: string): string {
  return jwt.sign({ sub: userId, purpose: '2fa' }, env.JWT_ACCESS_SECRET, {
    expiresIn: '5m',
    issuer: 'subplug',
    audience: 'subplug-api',
  });
}

export function verifyTwoFactorChallenge(token: string): string {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'subplug',
      audience: 'subplug-api',
    }) as { sub: string; purpose: string };
    if (decoded.purpose !== '2fa') throw new Error('wrong token purpose');
    return decoded.sub;
  } catch {
    throw AppError.unauthorized('Two-factor challenge expired. Please sign in again.', 'TWO_FACTOR_EXPIRED');
  }
}

function cookieBase() {
  return {
    httpOnly: true,
    secure: isProduction || env.COOKIE_SAME_SITE === 'none',
    sameSite: env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(COOKIES.access, accessToken, {
    ...cookieBase(),
    path: '/',
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000,
  });
  res.cookie(COOKIES.refresh, refreshToken, {
    ...cookieBase(),
    path: '/api/v1/auth',
    maxAge: refreshTtlMs,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIES.access, { ...cookieBase(), path: '/' });
  res.clearCookie(COOKIES.refresh, { ...cookieBase(), path: '/api/v1/auth' });
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(COOKIES.csrf, token, {
    httpOnly: false,
    secure: isProduction || env.COOKIE_SAME_SITE === 'none',
    sameSite: env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
    path: '/',
    maxAge: 2 * 60 * 60 * 1000,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
}

export async function createSession(user: { _id: unknown; role: Role }, req: Request): Promise<IssuedSession> {
  const refreshToken = randomToken(48);
  await Session.create({
    userId: user._id,
    tokenHash: sha256(refreshToken),
    familyId: randomToken(16),
    userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
    ip: req.ip ?? null,
    expiresAt: new Date(Date.now() + refreshTtlMs),
  });
  return {
    accessToken: signAccessToken(String(user._id), user.role),
    refreshToken,
  };
}

export async function rotateRefreshToken(rawToken: string, req: Request): Promise<IssuedSession> {
  const tokenHash = sha256(rawToken);
  const session = await Session.findOne({ tokenHash });
  if (!session) throw AppError.unauthorized('Invalid session', 'INVALID_SESSION');

  if (session.revokedAt) {
    // Possible token theft/replay: revoke the whole family.
    await Session.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    logger.warn({ userId: session.userId, familyId: session.familyId }, 'Refresh token reuse detected');
    throw AppError.unauthorized('Session revoked. Please sign in again.', 'SESSION_REPLAY');
  }
  if (session.expiresAt.getTime() < Date.now()) {
    throw AppError.unauthorized('Session expired. Please sign in again.', 'SESSION_EXPIRED');
  }

  const user = await User.findById(session.userId);
  if (!user || user.status !== 'ACTIVE') {
    throw AppError.unauthorized('Account unavailable', 'ACCOUNT_UNAVAILABLE');
  }

  const newToken = randomToken(48);
  session.revokedAt = new Date();
  session.replacedByTokenHash = sha256(newToken);
  await session.save();

  await Session.create({
    userId: user._id,
    tokenHash: sha256(newToken),
    familyId: session.familyId,
    userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
    ip: req.ip ?? null,
    expiresAt: new Date(Date.now() + refreshTtlMs),
  });

  return {
    accessToken: signAccessToken(String(user._id), user.role),
    refreshToken: newToken,
  };
}

export async function revokeRefreshToken(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await Session.updateOne(
    { tokenHash: sha256(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}
