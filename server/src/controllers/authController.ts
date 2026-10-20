import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { COOKIES } from '../config/constants';
import { generateCsrfToken } from '../utils/reference';
import { clearAuthCookies, revokeAllSessions, revokeRefreshToken, rotateRefreshToken, setAuthCookies, setCsrfCookie } from '../services/tokenService';
import * as authService from '../services/authService';
import { getWallet } from '../services/walletService';
import { AppError } from '../utils/AppError';
import { writeAudit } from '../services/auditService';

export const getCsrf = asyncHandler(async (_req: Request, res: Response) => {
  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken);
  res.json({ data: { csrfToken } });
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerUser(req.body, req);
  res.status(201).json({ data: result });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.loginUser(req.body.email, req.body.password, req, res);
  res.json({ data: result });
});

export const twoFactorLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.completeTwoFactorLogin(req.body.challengeToken, req.body.code, req, res);
  res.json({ data: result });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await revokeRefreshToken(req.cookies?.[COOKIES.refresh]);
  clearAuthCookies(res);
  if (req.user) {
    await writeAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: req.user.id,
      req,
    });
  }
  res.json({ data: { success: true } });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIES.refresh];
  if (!token) throw AppError.unauthorized('Session expired. Please sign in.', 'NO_REFRESH_TOKEN');
  try {
    const session = await rotateRefreshToken(token, req);
    setAuthCookies(res, session.accessToken, session.refreshToken);
    res.json({ data: { refreshed: true } });
  } catch (error) {
    clearAuthCookies(res);
    throw error;
  }
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getProfile(req.user!.id);
  const wallet = await getWallet(req.user!.id);
  res.json({ data: { ...user, wallet } });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.updateProfile(req.user!.id, req.body);
  res.json({ data: user });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  await authService.verifyEmail(req.body.token);
  res.json({ data: { verified: true } });
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.resendVerification(req.body.email);
  res.json({
    data: {
      message: 'If this account needs verification, a new email has been sent.',
      ...(result.devVerificationUrl ? { devVerificationUrl: result.devVerificationUrl } : {}),
    },
  });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body.email);
  res.json({
    data: {
      message: 'If an account exists for that email, a reset link has been sent.',
      ...(result.devResetUrl ? { devResetUrl: result.devResetUrl } : {}),
    },
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.json({ data: { success: true } });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  clearAuthCookies(res);
  res.json({ data: { success: true, reLoginRequired: true } });
});

export const setupTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.setupTwoFactor(req.user!.id);
  res.json({ data: result });
});

export const enableTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.enableTwoFactor(req.user!.id, req.body.code);
  res.json({ data: result });
});

export const disableTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.disableTwoFactor(req.user!.id, req.body.code, req.body.password);
  await revokeAllSessions(req.user!.id);
  clearAuthCookies(res);
  res.json({ data: { ...result, reLoginRequired: true } });
});
