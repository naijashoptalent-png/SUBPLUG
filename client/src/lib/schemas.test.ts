import { describe, expect, it } from 'vitest';
import {
  airtimeFormSchema,
  cableFormSchema,
  electricityFormSchema,
  passwordSchema,
  registerSchema,
  supportTicketSchema,
  walletAdjustSchema,
} from './schemas';

function firstMessage(result: { success: boolean; error?: { issues: Array<{ message: string; path: Array<string | number> }> } }) {
  if (result.success) return null;
  return result.error?.issues[0];
}

describe('client money validation', () => {
  it('accepts airtime at and above the minimum', () => {
    const valid = airtimeFormSchema.safeParse({
      network: 'MTN',
      phone: '08012345678',
      amount: '50',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects airtime below the minimum and reports the limit', () => {
    const result = airtimeFormSchema.safeParse({
      network: 'MTN',
      phone: '08012345678',
      amount: '49.99',
    });
    expect(result.success).toBe(false);
    expect(firstMessage(result)?.message).toContain('between ₦50 and ₦50000');
  });

  it('enforces the electricity minimum of ₦500', () => {
    const result = electricityFormSchema.safeParse({
      disco: 'IKEDC',
      meterNumber: '1234567890',
      meterType: 'PREPAID',
      amount: '499',
    });
    expect(result.success).toBe(false);
    expect(firstMessage(result)?.message).toContain('between ₦500');
  });

  it('validates admin adjustment reasons and positive amounts', () => {
    const bad = walletAdjustSchema.safeParse({
      amount: '0',
      direction: 'CREDIT',
      reason: 'short',
    });
    expect(bad.success).toBe(false);

    const good = walletAdjustSchema.safeParse({
      amount: '100',
      direction: 'CREDIT',
      reason: 'Goodwill credit for verified outage',
    });
    expect(good.success).toBe(true);
  });
});

describe('identity and account validation', () => {
  it('rejects weak passwords with specific guidance', () => {
    expect(firstMessage(passwordSchema.safeParse('short'))?.message).toContain('at least 10');
    expect(firstMessage(passwordSchema.safeParse('alllowercase1!'))?.message).toContain('uppercase');
    expect(firstMessage(passwordSchema.safeParse('ALLUPPERCASE1!'))?.message).toContain('lowercase');
    expect(passwordSchema.safeParse('StrongPass1!').success).toBe(true);
  });

  it('rejects mismatched registration passwords', () => {
    const result = registerSchema.safeParse({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '08012345678',
      password: 'StrongPass1!',
      confirmPassword: 'DifferentPass1!',
      acceptTerms: true,
    });

    expect(result.success).toBe(false);
    expect(result.success ? null : result.error.issues[0]?.path).toEqual(['confirmPassword']);
  });

  it('requires terms acceptance', () => {
    const result = registerSchema.safeParse({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '08012345678',
      password: 'StrongPass1!',
      confirmPassword: 'StrongPass1!',
      acceptTerms: false,
    });

    expect(result.success).toBe(false);
  });
});

describe('bill and support validation', () => {
  it('accepts 8–12 digit smartcard numbers only', () => {
    expect(
      cableFormSchema.safeParse({
        cableProvider: 'DSTV',
        smartcardNumber: '12345678',
        providerPlanId: 'DSTV-PADI',
      }).success
    ).toBe(true);

    expect(
      cableFormSchema.safeParse({
        cableProvider: 'DSTV',
        smartcardNumber: '1234567',
        providerPlanId: 'DSTV-PADI',
      }).success
    ).toBe(false);
  });

  it('requires a detailed support message', () => {
    const result = supportTicketSchema.safeParse({
      subject: 'Missing token',
      category: 'TRANSACTION_DISPUTE',
      message: 'Too short',
    });

    expect(result.success).toBe(false);
  });
});
