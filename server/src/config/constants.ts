export const CURRENCY = 'NGN' as const;

export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  SUPPORT: 'SUPPORT',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
export const STAFF_ROLES: Role[] = [ROLES.SUPPORT, ROLES.ADMIN];

export const NETWORKS = ['MTN', 'AIRTEL', 'GLO', '9MOBILE'] as const;
export type Network = (typeof NETWORKS)[number];

export const SERVICE_TYPES = ['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const TRANSACTION_STATUSES = [
  'CREATED',
  'PENDING',
  'PROCESSING',
  'SUCCESSFUL',
  'FAILED',
  'REVERSED',
  'REFUNDED',
  'REQUIRES_REVIEW',
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const FUNDING_STATUSES = [
  'PENDING',
  'SUCCESSFUL',
  'FAILED',
  'ABANDONED',
  'REQUIRES_REVIEW',
] as const;
export type FundingStatus = (typeof FUNDING_STATUSES)[number];

export const LEDGER_TYPES = [
  'FUNDING_CREDIT',
  'PURCHASE_DEBIT',
  'REFUND',
  'ADJUSTMENT_CREDIT',
  'ADJUSTMENT_DEBIT',
  'REFERRAL_REWARD',
  'REVERSAL',
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export const COOKIES = {
  access: 'qt_access',
  refresh: 'qt_refresh',
  csrf: 'qt_csrf',
} as const;

export const SETTING_KEYS = {
  branding: 'branding',
  support: 'support',
  maintenance: 'maintenance',
  registration: 'registration',
  limits: 'limits',
  discounts: 'discounts',
  pricing: 'pricing',
  providerRouting: 'providerRouting',
  referrals: 'referrals',
  notifications: 'notifications',
} as const;

export const DEFAULT_SETTINGS = {
  branding: {
    name: 'SubPlug',
    tagline: 'Top up life, simply.',
    primaryColor: '#0f766e',
    supportEmail: 'support@example.com',
    supportPhone: '+2348000000000',
  },
  support: {
    email: 'support@example.com',
    phone: '+2348000000000',
    whatsapp: '',
    hours: 'Mon–Sat, 8:00–20:00 WAT',
  },
  maintenance: {
    enabled: false,
    message: 'We are carrying out scheduled maintenance. Please check back shortly.',
    allowAdmins: true,
  },
  registration: {
    enabled: true,
    requirePhoneVerification: false,
    allowReferrals: true,
  },
  limits: {
    airtimeMinMinor: 5000,
    airtimeMaxMinor: 5000000,
    dataMinMinor: 10000,
    dataMaxMinor: 5000000,
    electricityMinMinor: 50000,
    electricityMaxMinor: 10000000,
    cableMinMinor: 10000,
    cableMaxMinor: 10000000,
    fundingMinMinor: 10000,
    fundingMaxMinor: 100000000,
    manualReviewThresholdMinor: 5000000,
    maxDailySpendMinor: 20000000,
  },
  discounts: {
    airtimePercent: { MTN: 2, AIRTEL: 2, GLO: 2, '9MOBILE': 2 },
    serviceFeePercent: 0,
  },
  pricing: {
    dataMarkupPercent: 8,
    cableMarkupPercent: 4,
    electricityFeeMinor: 0,
    cableFeeMinor: 0,
    preserveManualPlanPricing: true,
  },
  providerRouting: {
    // Empty means "fall back to the VTU_*_PROVIDER environment value".
    // Only airtime and data are switchable at runtime; cable and electricity
    // are fixed to MaskawaSub in the provider resolver.
    airtimeProvider: '',
    dataProvider: '',
  },
  referrals: {
    enabled: true,
    rewardMinor: 20000,
    qualifyingPurchaseMinor: 10000,
    maxReferralsPerUser: 50,
  },
  notifications: {
    emailOnPurchase: true,
    emailOnFunding: true,
    smsOnPurchase: false,
  },
} as const;
