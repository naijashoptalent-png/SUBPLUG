import { z } from 'zod';
import { FUNDING_STATUSES, NETWORKS, SERVICE_TYPES, TRANSACTION_STATUSES } from '../config/constants';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
export const phoneSchema = z
  .string()
  .trim()
  .min(10, 'Enter a valid Nigerian phone number')
  .max(20)
  .regex(/^\+?[0-9\s()-]+$/, 'Phone number can only contain digits, spaces and +()-');

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password is too long')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol');

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid identifier');
export const idempotencyHeaderSchema = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(100),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    referralCode: z.string().trim().max(30).optional().or(z.literal('')),
    acceptTerms: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const refreshSchema = z.object({}).passthrough();

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    phone: phoneSchema.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No changes supplied' });

export const twoFactorCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });
export const twoFactorLoginSchema = z.object({
  challengeToken: z.string().min(20),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export const twoFactorDisableSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  password: z.string().min(1),
});

const amountMinorSchema = z
  .number({ invalid_type_error: 'Enter a valid amount' })
  .int('Amount must be in whole kobo')
  .positive('Amount must be positive');

export const fundWalletSchema = z.object({ amountMinor: amountMinorSchema });

export const airtimePurchaseSchema = z.object({
  network: z.enum(NETWORKS),
  phone: phoneSchema,
  amountMinor: amountMinorSchema,
});

export const dataPurchaseSchema = z.object({
  network: z.enum(NETWORKS),
  phone: phoneSchema,
  providerPlanId: z.string().trim().min(2).max(100),
});

export const electricityPurchaseSchema = z.object({
  disco: z.string().trim().toUpperCase().min(2).max(20),
  meterNumber: z.string().trim().regex(/^\d{10,13}$/, 'Meter number must be 10–13 digits'),
  meterType: z.enum(['PREPAID', 'POSTPAID']),
  amountMinor: amountMinorSchema,
});

export const cablePurchaseSchema = z.object({
  cableProvider: z.string().trim().toUpperCase().min(2).max(20),
  smartcardNumber: z.string().trim().regex(/^\d{8,12}$/, 'Smartcard number must be 8–12 digits'),
  providerPlanId: z.string().trim().min(2).max(100),
});

export const meterValidationSchema = z.object({
  disco: z.string().trim().toUpperCase().min(2).max(20),
  meterNumber: z.string().trim().regex(/^\d{10,13}$/, 'Meter number must be 10–13 digits'),
  meterType: z.enum(['PREPAID', 'POSTPAID']),
});

export const smartcardValidationSchema = z.object({
  cableProvider: z.string().trim().toUpperCase().min(2).max(20),
  smartcardNumber: z.string().trim().regex(/^\d{8,12}$/, 'Smartcard number must be 8–12 digits'),
});

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const transactionQuerySchema = z.object({
  ...pagination,
  service: z.enum(SERVICE_TYPES).optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const ledgerQuerySchema = z.object({
  ...pagination,
  type: z.string().optional(),
  direction: z.enum(['CREDIT', 'DEBIT']).optional(),
});

export const paginationQuerySchema = z.object({ ...pagination });

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(5, 'Subject is too short').max(150),
  category: z.enum(['TRANSACTION_DISPUTE', 'WALLET', 'ACCOUNT', 'OTHER']),
  message: z.string().trim().min(20, 'Please describe your issue in at least 20 characters').max(4000),
  transactionReference: z.string().trim().max(100).optional(),
});

export const ticketMessageSchema = z.object({
  body: z.string().trim().min(2, 'Message is too short').max(4000),
});

export const supportQuerySchema = z.object({
  ...pagination,
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  search: z.string().trim().max(100).optional(),
});

export const frontendContactSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  subject: z.string().trim().min(5).max(150),
  message: z.string().trim().min(20).max(4000),
});

export const adminUsersQuerySchema = z.object({
  ...pagination,
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']).optional(),
  role: z.enum(['CUSTOMER', 'SUPPORT', 'ADMIN']).optional(),
});

export const adminUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.string().trim().min(5, 'Provide a reason').max(300),
});

export const adminWalletAdjustSchema = z.object({
  userId: objectIdSchema,
  amountMinor: amountMinorSchema,
  direction: z.enum(['CREDIT', 'DEBIT']),
  reason: z.string().trim().min(10, 'Provide a detailed reason').max(300),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
});

export const adminRejectReviewSchema = z.object({
  reason: z.string().trim().min(10).max(300),
});

export const adminFundingQuerySchema = z.object({
  ...pagination,
  status: z.enum(FUNDING_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  userId: z.string().trim().max(30).optional(),
});

export const adminAuditQuerySchema = z.object({
  ...pagination,
  action: z.string().trim().max(100).optional(),
  actorId: z.string().trim().max(30).optional(),
  entityType: z.string().trim().max(50).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const adminPlansQuerySchema = z.object({
  ...pagination,
  service: z.enum(SERVICE_TYPES).optional(),
  network: z.string().trim().max(30).optional(),
  search: z.string().trim().max(100).optional(),
});

export const adminPlanUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    sellingPriceMinor: z.number().int().positive().optional(),
    name: z.string().trim().min(2).max(150).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No changes supplied' });

export const adminSettingsSchema = z.object({
  key: z.string().trim().min(2).max(50),
  value: z.record(z.unknown()),
  confirm: z.string().max(50).optional(),
});

export const providerRouteSwitchSchema = z.object({
  service: z.enum(['AIRTIME', 'DATA']),
  provider: z.enum(['sme', 'maskawasub']),
});

export const sandboxOutcomeSchema = z.object({
  outcome: z.enum(['success', 'failed']),
});

export const adminSupportReplySchema = z.object({
  body: z.string().trim().min(2).max(4000),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
});

export const adminTransactionQuerySchema = transactionQuerySchema.extend({
  userId: z.string().trim().max(30).optional(),
  provider: z.string().trim().max(50).optional(),
});

export const referenceParamSchema = z.object({
  reference: z.string().trim().min(5).max(100),
});

export const idParamSchema = z.object({ id: objectIdSchema });
export const ticketParamSchema = z.object({ id: objectIdSchema });

export const overviewQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
