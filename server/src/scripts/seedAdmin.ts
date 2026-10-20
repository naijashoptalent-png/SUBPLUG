import { env } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { logger } from '../config/logger';
import { User, Wallet } from '../models';
import { hashPassword, normalizePhone } from '../services/authService';
import { generateReferralCode } from '../utils/reference';

export async function seedAdmin(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment before seeding an administrator.');
  }
  if (
    env.ADMIN_PASSWORD.length < 12 ||
    !/[A-Z]/.test(env.ADMIN_PASSWORD) ||
    !/[a-z]/.test(env.ADMIN_PASSWORD) ||
    !/[0-9]/.test(env.ADMIN_PASSWORD) ||
    !/[^A-Za-z0-9]/.test(env.ADMIN_PASSWORD)
  ) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters with upper, lower, number and symbol.');
  }

  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'ADMIN') {
      throw new Error(`A non-admin account already uses ${email}. Refusing to auto-promote it.`);
    }
    if (!existing.emailVerifiedAt) {
      existing.emailVerifiedAt = new Date();
      await existing.save();
    }
    await Wallet.updateOne(
      { userId: existing._id },
      { $setOnInsert: { userId: existing._id, balanceMinor: 0, status: 'ACTIVE' } },
      { upsert: true }
    );
    logger.info({ email }, 'Administrator already exists; password left unchanged');
    return;
  }

  const phone = normalizePhone(env.ADMIN_PHONE || '08000000000');
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  const admin = await User.create({
    fullName: env.ADMIN_NAME || 'Platform Administrator',
    email,
    phone,
    passwordHash,
    role: 'ADMIN',
    status: 'ACTIVE',
    emailVerifiedAt: new Date(),
    referralCode: generateReferralCode(env.ADMIN_NAME || 'Admin'),
  });
  await Wallet.create({ userId: admin._id, balanceMinor: 0 });
  logger.info({ email }, 'Administrator account created');
}

if (require.main === module) {
  connectDatabase()
    .then(seedAdmin)
    .then(() => disconnectDatabase())
    .then(() => process.exit(0))
    .catch((error) => {
      logger.fatal({ err: error }, 'Administrator seed failed');
      process.exit(1);
    });
}
