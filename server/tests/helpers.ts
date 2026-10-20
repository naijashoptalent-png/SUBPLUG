import { randomBytes } from 'crypto';
import { User } from '../src/models';

export async function createUser(overrides: Record<string, unknown> = {}) {
  const suffix = randomBytes(4).toString('hex');
  return User.create({
    fullName: 'Test Customer',
    email: `customer-${suffix}@example.com`,
    phone: `080${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
    passwordHash: 'not-used-in-service-tests',
    referralCode: `T${suffix.toUpperCase()}`,
    emailVerifiedAt: new Date(),
    ...overrides,
  });
}

export function uniqueReference(prefix: string) {
  return `${prefix}-${randomBytes(5).toString('hex').toUpperCase()}`;
}
