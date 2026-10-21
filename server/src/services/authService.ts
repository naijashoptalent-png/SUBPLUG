import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { Request } from 'express';
import { User, Wallet, Referral } from '../models';
import { AppError } from '../utils/AppError';
import { randomToken, sha256 } from '../utils/crypto';
import { generateReferralCode } from '../utils/reference';
import { env, isProduction } from '../config/env';
import {
  sendPasswordResetEmail,
  sendSecurityAlert,
} from './emailService';
import { notify } from './notificationService';
import { getSetting } from './settingsService';
import {
  createSession,
  signAccessToken,
  signTwoFactorChallenge,
  setAuthCookies,
  verifyTwoFactorChallenge,
  revokeAllSessions,
} from './tokenService';
import { runInTransaction } from '../utils/transactionRunner';
import { writeAudit } from './auditService';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export function normalizePhone(input: string): string {
  const cleaned = input.replace(/[\s()-]/g, '');
  let local = cleaned;
  if (local.startsWith('+234')) local = local.slice(4);
  else if (local.startsWith('234')) local = local.slice(3);
  else if (local.startsWith('0')) local = local.slice(1);
  if (!/^[789][01]\d{8}$/.test(local)) {
    throw AppError.badRequest('Enter a valid Nigerian phone number', 'INVALID_PHONE');
  }
  return `+234${local}`;
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

interface UserLike {
  _id: unknown;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
  twoFactorEnabled?: boolean;
  referralCode: string;
  createdAt?: Date;
  lastLoginAt?: Date | null;
}

function publicUser(user: UserLike) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    twoFactorEnabled: user.twoFactorEnabled,
    referralCode: user.referralCode,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

async function uniqueReferralCode(fullName: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode(fullName);
    const exists = await User.exists({ referralCode: code });
    if (!exists) return code;
  }
  return `QT${Date.now().toString(36).toUpperCase()}${randomToken(2).toUpperCase()}`;
}

interface RegisterInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  referralCode?: string;
}

export async function registerUser(input: RegisterInput, req: Request) {
  const registration = await getSetting('registration');
  if (!registration.enabled) {
    throw AppError.forbidden('Registration is temporarily disabled', 'REGISTRATION_DISABLED');
  }

  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const existing = await User.findOne({ $or: [{ email }, { phone }] }).select('email phone');
  if (existing) {
    if (existing.email === email) throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
    throw AppError.conflict('An account with this phone number already exists', 'PHONE_TAKEN');
  }

  let referrer: { _id: unknown; email: string; phone: string } | null = null;
  const rawReferral = input.referralCode?.trim().toUpperCase();
  if (rawReferral) {
    referrer = await User.findOne({ referralCode: rawReferral }).select('email phone');
    if (!referrer) throw AppError.badRequest('Referral code is not valid', 'INVALID_REFERRAL_CODE');
    if (referrer.email === email || referrer.phone === phone) {
      throw AppError.badRequest('You cannot refer yourself', 'SELF_REFERRAL');
    }
  }

  const passwordHash = await hashPassword(input.password);
  const referralCode = await uniqueReferralCode(input.fullName);

  const user = await runInTransaction(async (session) => {
    const [created] = await User.create(
      [
        {
          fullName: input.fullName.trim().replace(/\s+/g, ' '),
          email,
          phone,
          passwordHash,
          referralCode,
          referredBy: referrer?._id ?? null,
          // Email verification is not part of the sign-up flow. Mark accounts
          // as active immediately, while retaining the field for existing data.
          emailVerifiedAt: new Date(),
        },
      ],
      session ? { session } : {}
    );
    await Wallet.create([{ userId: created._id, balanceMinor: 0 }], session ? { session } : {});
    if (referrer) {
      await Referral.create(
        [
          {
            referrerId: referrer._id,
            referredUserId: created._id,
            code: rawReferral,
            status: 'PENDING',
          },
        ],
        session ? { session } : {}
      );
    }
    return created;
  });

  await notify({
    userId: String(user._id),
    type: 'SYSTEM',
    title: 'Welcome to SubPlug',
    body: 'Your account is ready. Fund your wallet to make your first purchase.',
    link: '/dashboard',
  });

  await writeAudit({
    actorId: String(user._id),
    actorRole: user.role,
    action: 'USER_REGISTERED',
    entityType: 'User',
    entityId: String(user._id),
    req,
  });

  return {
    user: publicUser(user.toObject()),
  };
}

interface LoginResult {
  user?: ReturnType<typeof publicUser>;
  requiresTwoFactor?: boolean;
  challengeToken?: string;
}

export async function loginUser(
  emailRaw: string,
  password: string,
  req: Request,
  res: Parameters<typeof setAuthCookies>[0]
): Promise<LoginResult> {
  const email = normalizeEmail(emailRaw);
  const user = await User.findOne({ email }).select('+passwordHash +twoFactorSecret +failedLoginAttempts');

  // Constant-ish work for unknown users to reduce timing-based enumeration.
  if (!user) {
    await bcrypt.compare(password, '$2a$12$C6UzMDM.H6dfI/f/IKcEe.7y6vP1gF4ozXrCN9vUZ3nZ7vYpYbK5S').catch(() => false);
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new AppError(423, 'ACCOUNT_LOCKED', 'Too many failed sign-in attempts. Try again later or reset your password.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
      await sendSecurityAlert(
        user.email,
        'Your account was temporarily locked after repeated failed sign-in attempts.'
      );
    }
    await user.save();
    await writeAudit({
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: String(user._id),
      actorId: String(user._id),
      req,
    });
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.status === 'SUSPENDED') {
    throw AppError.forbidden(
      user.suspensionReason
        ? `Your account is suspended. Reason: ${user.suspensionReason}. Contact support.`
        : 'Your account is suspended. Contact support.',
      'ACCOUNT_SUSPENDED'
    );
  }
  if (user.status === 'CLOSED') {
    throw AppError.forbidden('This account is closed', 'ACCOUNT_CLOSED');
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;

  if (user.twoFactorEnabled) {
    await user.save();
    return { requiresTwoFactor: true, challengeToken: signTwoFactorChallenge(String(user._id)) };
  }

  user.lastLoginAt = new Date();
  await user.save();

  const session = await createSession(user, req);
  setAuthCookies(res, session.accessToken, session.refreshToken);

  await writeAudit({
    actorId: String(user._id),
    actorRole: user.role,
    action: 'LOGIN_SUCCESS',
    entityType: 'User',
    entityId: String(user._id),
    req,
  });

  return { user: publicUser(user.toObject()) };
}

export async function completeTwoFactorLogin(
  challengeToken: string,
  code: string,
  req: Request,
  res: Parameters<typeof setAuthCookies>[0]
) {
  const userId = verifyTwoFactorChallenge(challengeToken);
  const user = await User.findById(userId).select('+twoFactorSecret');
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw AppError.unauthorized('Two-factor authentication is not available', 'TWO_FACTOR_UNAVAILABLE');
  }
  if (!authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
    throw AppError.badRequest('Invalid authenticator code', 'INVALID_TOTP');
  }
  if (user.status !== 'ACTIVE') throw AppError.forbidden('Account unavailable', 'ACCOUNT_UNAVAILABLE');

  user.lastLoginAt = new Date();
  await user.save();
  const session = await createSession(user, req);
  setAuthCookies(res, session.accessToken, session.refreshToken);
  await writeAudit({
    actorId: String(user._id),
    actorRole: user.role,
    action: 'LOGIN_SUCCESS_2FA',
    entityType: 'User',
    entityId: String(user._id),
    req,
  });
  return { user: publicUser(user.toObject()) };
}

export async function getProfile(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw AppError.notFound('User not found');
  return publicUser(user);
}

export async function updateProfile(userId: string, input: { fullName?: string; phone?: string }) {
  const updates: Record<string, unknown> = {};
  if (input.fullName) updates.fullName = input.fullName.trim().replace(/\s+/g, ' ');
  if (input.phone) {
    const phone = normalizePhone(input.phone);
    const existing = await User.findOne({ phone, _id: { $ne: userId } }).select('_id');
    if (existing) throw AppError.conflict('This phone number is already in use', 'PHONE_TAKEN');
    updates.phone = phone;
    updates.phoneVerifiedAt = null;
  }
  const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true }).lean();
  if (!user) throw AppError.notFound('User not found');
  return publicUser(user);
}

export async function forgotPassword(emailRaw: string): Promise<{ devResetUrl?: string }> {
  const email = normalizeEmail(emailRaw);
  const user = await User.findOne({ email });
  if (!user || user.status === 'CLOSED') return {};

  const token = randomToken(32);
  user.passwordResetTokenHash = sha256(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, user.fullName, resetUrl);
  await writeAudit({
    action: 'PASSWORD_RESET_REQUESTED',
    entityType: 'User',
    entityId: String(user._id),
    actorId: String(user._id),
  });
  return { devResetUrl: !isProduction && env.EXPOSE_DEV_EMAILS ? resetUrl : undefined };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const user = await User.findOne({
    passwordResetTokenHash: sha256(token),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) throw AppError.badRequest('Reset link is invalid or expired', 'INVALID_RESET_TOKEN');

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();
  await revokeAllSessions(String(user._id));
  await sendSecurityAlert(user.email, 'Your password was reset. All existing sessions have been signed out.');
  await writeAudit({
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'User',
    entityId: String(user._id),
    actorId: String(user._id),
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw AppError.notFound('User not found');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw AppError.badRequest('Current password is incorrect', 'INVALID_PASSWORD');
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeAllSessions(userId);
  await sendSecurityAlert(user.email, 'Your password was changed and all sessions were signed out.');
}

export async function setupTwoFactor(userId: string) {
  const user = await User.findById(userId).select('+twoFactorSecret');
  if (!user) throw AppError.notFound('User not found');
  if (user.twoFactorEnabled) throw AppError.conflict('Two-factor authentication is already enabled', 'TWO_FACTOR_ENABLED');
  const secret = authenticator.generateSecret();
  user.twoFactorSecret = secret;
  await user.save();
  const otpauthUrl = authenticator.keyuri(user.email, 'SubPlug', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, otpauthUrl, qrCodeDataUrl };
}

export async function enableTwoFactor(userId: string, code: string) {
  const user = await User.findById(userId).select('+twoFactorSecret');
  if (!user || !user.twoFactorSecret) throw AppError.badRequest('Start two-factor setup first', 'TWO_FACTOR_NOT_STARTED');
  if (!authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
    throw AppError.badRequest('Invalid authenticator code', 'INVALID_TOTP');
  }
  user.twoFactorEnabled = true;
  await user.save();
  await notify({
    userId,
    type: 'SECURITY',
    title: 'Two-factor authentication enabled',
    body: 'Your account is now protected with an authenticator app.',
  });
  return { enabled: true };
}

export async function disableTwoFactor(userId: string, code: string, password: string) {
  const user = await User.findById(userId).select('+passwordHash +twoFactorSecret');
  if (!user || !user.twoFactorEnabled) throw AppError.badRequest('Two-factor authentication is not enabled', 'TWO_FACTOR_DISABLED');
  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) throw AppError.badRequest('Password is incorrect', 'INVALID_PASSWORD');
  if (!user.twoFactorSecret || !authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
    throw AppError.badRequest('Invalid authenticator code', 'INVALID_TOTP');
  }
  user.twoFactorEnabled = false;
  user.twoFactorSecret = null;
  await user.save();
  await sendSecurityAlert(user.email, 'Two-factor authentication was disabled on your account.');
  return { enabled: false };
}

export function sessionPayload(userId: string, role: Parameters<typeof signAccessToken>[1]) {
  return { accessToken: signAccessToken(userId, role) };
}

export function accessTokenFor(userId: string, role: Parameters<typeof signAccessToken>[1]) {
  return signAccessToken(userId, role);
}

export { publicUser };
