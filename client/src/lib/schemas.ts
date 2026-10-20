import { z } from 'zod';
import { parseNairaToMinor } from './format';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(254);

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
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number')
  .regex(/[^A-Za-z0-9]/, 'Include a symbol');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(100),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    referralCode: z.string().trim().max(30).optional(),
    acceptTerms: z.boolean().refine((value) => value, {
      message: 'Please accept the terms to continue',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterForm = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: phoneSchema,
});
export type ProfileForm = z.infer<typeof profileSchema>;

export const twoFactorCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

/** Validates a Naira string and exposes the integer-kobo value to the caller. */
export function amountString(minMinor: number, maxMinor: number) {
  return z
    .string()
    .min(1, 'Enter an amount')
    .superRefine((value, context) => {
      const minor = parseNairaToMinor(value);
      if (minor === null || minor <= 0) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid amount' });
        return;
      }
      if (minor < minMinor || minor > maxMinor) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Amount must be between ₦${minMinor / 100} and ₦${maxMinor / 100}`,
        });
      }
    });
}

export const airtimeFormSchema = z.object({
  network: z.enum(['MTN', 'AIRTEL', 'GLO', '9MOBILE'], { errorMap: () => ({ message: 'Choose a network' }) }),
  phone: phoneSchema,
  amount: amountString(5000, 5_000_000),
});
export type AirtimeForm = z.infer<typeof airtimeFormSchema>;

export const dataFormSchema = z.object({
  network: z.enum(['MTN', 'AIRTEL', 'GLO', '9MOBILE'], { errorMap: () => ({ message: 'Choose a network' }) }),
  phone: phoneSchema,
  providerPlanId: z.string().min(2, 'Choose a data plan'),
});
export type DataForm = z.infer<typeof dataFormSchema>;

export const electricityFormSchema = z.object({
  disco: z.string().min(2, 'Choose a distribution company'),
  meterNumber: z.string().regex(/^\d{10,13}$/, 'Meter number must be 10–13 digits'),
  meterType: z.enum(['PREPAID', 'POSTPAID']),
  amount: amountString(50000, 10_000_000),
});
export type ElectricityForm = z.infer<typeof electricityFormSchema>;

export const cableFormSchema = z.object({
  cableProvider: z.string().min(2, 'Choose a cable provider'),
  smartcardNumber: z.string().regex(/^\d{8,12}$/, 'Smartcard number must be 8–12 digits'),
  providerPlanId: z.string().min(2, 'Choose a package'),
});
export type CableForm = z.infer<typeof cableFormSchema>;

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(5, 'Subject is too short').max(150),
  category: z.enum(['TRANSACTION_DISPUTE', 'WALLET', 'ACCOUNT', 'OTHER']),
  message: z.string().trim().min(20, 'Please describe your issue in at least 20 characters').max(4000),
  transactionReference: z.string().trim().max(100).optional(),
});
export type SupportTicketForm = z.infer<typeof supportTicketSchema>;

export const contactSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(100),
  email: emailSchema,
  phone: z.string().trim().max(20).optional(),
  subject: z.string().trim().min(5, 'Subject is too short').max(150),
  message: z.string().trim().min(20, 'Please include at least 20 characters').max(4000),
});
export type ContactForm = z.infer<typeof contactSchema>;

export const ticketReplySchema = z.object({
  body: z.string().trim().min(2, 'Write a message').max(4000),
});
export type TicketReplyForm = z.infer<typeof ticketReplySchema>;

export const walletAdjustSchema = z.object({
  amount: amountString(100, 100_000_000),
  direction: z.enum(['CREDIT', 'DEBIT']),
  reason: z.string().trim().min(10, 'Provide a detailed reason').max(300),
});
