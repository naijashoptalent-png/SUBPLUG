export type Role = 'CUSTOMER' | 'SUPPORT' | 'ADMIN';
export type ServiceType = 'AIRTIME' | 'DATA' | 'ELECTRICITY' | 'CABLE';
export type Network = 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';
export type TransactionStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'REVERSED'
  | 'REFUNDED'
  | 'REQUIRES_REVIEW';
export type FundingStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'ABANDONED' | 'REQUIRES_REVIEW';
export type LedgerType =
  | 'FUNDING_CREDIT'
  | 'PURCHASE_DEBIT'
  | 'REFUND'
  | 'ADJUSTMENT_CREDIT'
  | 'ADJUSTMENT_DEBIT'
  | 'REFERRAL_REWARD'
  | 'REVERSAL';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  referralCode: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Wallet {
  id: string;
  balanceMinor: number;
  currency: string;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  updatedAt: string;
}

export interface WalletOverview {
  wallet: Wallet;
  lifetimeCreditsMinor: number;
  lifetimeDebitsMinor: number;
  activity: Array<{ date: string; creditsMinor: number; debitsMinor: number }>;
}

export interface VirtualAccount {
  status: 'ACTIVE' | 'PENDING';
  accountNumber?: string;
  bankName?: string;
  reference?: string;
  createdAt?: string;
}

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  direction: 'CREDIT' | 'DEBIT';
  amountMinor: number;
  balanceAfterMinor: number;
  currency: string;
  reference: string;
  description: string;
  fundingId?: string | null;
  transaction?: { reference: string; service: ServiceType; status: TransactionStatus } | null;
  createdAt: string;
}

export interface Funding {
  _id?: string;
  reference: string;
  userId?: string;
  amountMinor: number;
  currency?: string;
  status: FundingStatus;
  gateway: string;
  gatewayReference?: string | null;
  gatewayPayload?: Record<string, unknown> | null;
  isSandbox: boolean;
  authorizationUrl?: string | null;
  paidAt?: string | null;
  verifiedAt?: string | null;
  creditedAt?: string | null;
  failureReason?: string | null;
  reviewReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FundingInit {
  reference: string;
  amountMinor: number;
  status: FundingStatus;
  authorizationUrl: string | null;
  gateway: string;
  isSandbox: boolean;
  duplicate: boolean;
}

export interface NetworkInfo {
  code: string;
  name: string;
}

export interface DataPlan {
  id: string;
  providerPlanId: string;
  network: string;
  name: string;
  dataVolume: string | null;
  validity: string | null;
  category: string;
  categoryLabel: string;
  priceMinor: number;
  isSandbox: boolean;
  available: boolean;
}

export interface ElectricityProvider {
  code: string;
  name: string;
  isSandbox: boolean;
}

export interface CableProvider {
  code: string;
  name: string;
  isSandbox: boolean;
}

export interface CablePackage {
  id: string;
  providerPlanId: string;
  network: string;
  name: string;
  validity: string | null;
  priceMinor: number;
  isSandbox: boolean;
}

export interface ServiceSummary {
  key: ServiceType;
  name: string;
  enabled: boolean;
  description: string;
  networks?: NetworkInfo[];
  planners?: unknown;
  planCount?: number;
  providers?: Array<{ code: string; name: string; isSandbox: boolean }>;
}

export interface AirtimeQuote {
  network: string;
  faceValueMinor: number;
  discountPercent: number;
  discountMinor: number;
  feeMinor: number;
  payableMinor: number;
  isSandbox: boolean;
}

export interface Recipient {
  phone?: string;
  network?: string;
  disco?: string;
  meterNumber?: string;
  meterType?: string;
  cableProvider?: string;
  smartcardNumber?: string;
  customerName?: string;
  customerAddress?: string;
}

export interface Transaction {
  id: string;
  reference: string;
  userId?: string;
  service: ServiceType;
  amountMinor: number;
  payableMinor: number;
  feeMinor: number;
  discountMinor: number;
  costMinor?: number;
  marginMinor?: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod: string;
  /** Admin-only operational data; omitted from customer responses. */
  provider?: string;
  providerReference?: string | null;
  providerStatus: string | null;
  providerPayload?: unknown;
  reviewReason: string | null;
  recipient: Recipient;
  plan: {
    code?: string;
    name?: string;
    dataVolume?: string;
    validity?: string;
  } | null;
  fulfillment: {
    token: string | null;
    units: string | null;
    customerName: string | null;
    customerAddress: string | null;
  };
  failureReason: string | null;
  refundedAt: string | null;
  refundedAmountMinor: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  statusHistory: Array<{ status: TransactionStatus; at: string; note?: string }>;
  isSandbox: boolean;
  metadata?: Record<string, unknown>;
  duplicate?: boolean;
  heldForReview?: boolean;
}

export interface DashboardSummary {
  wallet: Wallet;
  recentTransactions: Transaction[];
  statusCounts: { successful: number; pending: number; failed: number };
  monthlyActivity: Array<{ date: string; amountMinor: number }>;
  provider: { isSandbox: boolean };
}

export interface NotificationItem {
  _id: string;
  type: 'SYSTEM' | 'TRANSACTION' | 'FUNDING' | 'SECURITY' | 'REFERRAL' | 'SUPPORT' | 'REFUND';
  title: string;
  body: string;
  link?: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface SupportMessage {
  _id?: string;
  authorId: string;
  authorRole: Role;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  _id: string;
  reference: string;
  userId: string | { _id: string; fullName: string; email: string };
  subject: string;
  category: 'TRANSACTION_DISPUTE' | 'WALLET' | 'ACCOUNT' | 'OTHER';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority?: 'NORMAL' | 'HIGH';
  transactionReference?: string | null;
  messages?: SupportMessage[];
  lastMessageAt: string;
  createdAt: string;
}

export interface ReferralSummary {
  enabled: boolean;
  code: string;
  rewardMinor: number;
  qualifyingPurchaseMinor: number;
  totals: { referrals: number; pending: number; rewarded: number; earnedMinor: number };
  referrals: Array<{
    id: string;
    referredName: string;
    status: 'PENDING' | 'QUALIFIED' | 'REWARDED' | 'REJECTED';
    rewardMinor: number | null;
    createdAt: string;
    rewardedAt: string | null;
  }>;
}

export interface PaymentMethod {
  key: string;
  name: string;
  isSandbox: boolean;
}

export interface PublicSettings {
  branding: {
    name: string;
    tagline: string;
    primaryColor: string;
    supportEmail: string;
    supportPhone: string;
  };
  support: { email: string; phone: string; whatsapp: string; hours: string };
  maintenance: { enabled: boolean; message: string };
  referralsEnabled: boolean;
  environment: {
    vtuSandbox: boolean;
    paymentSandbox: boolean;
    paymentGateway: string;
    paymentMethods: PaymentMethod[];
  };
}

export interface ManualFundingSettings {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
}

export interface AdminOverview {
  periodDays: number;
  users: { total: number; new: number };
  transactions: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    successRate: number | null;
    statuses: Record<string, number>;
  };
  funding: { totalMinor: number; count: number; reviewCount: number };
  revenue: { grossMarginMinor: number; transactionVolumeMinor: number };
  services: Array<{ service: ServiceType; count: number; volumeMinor: number; successful: number }>;
  daily: Array<{ _id: string; count: number; volumeMinor: number; revenueMinor: number; successful: number; failed: number }>;
  providers: Array<{
    key: string;
    name: string;
    kind: 'VTU' | 'PAYMENT';
    health: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
    enabled: boolean;
    isSandbox: boolean;
    lastCheckedAt: string | null;
    lastError: string | null;
  }>;
}

export interface AdminUser {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  emailVerifiedAt: string | null;
  referralCode: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUserDetail {
  user: User & { suspensionReason?: string | null; twoFactorEnabled?: boolean };
  wallet: { balanceMinor: number; status: string; currency: string } | null;
  transactionCounts: Record<string, number>;
  recentTransactions: Array<{
    reference: string;
    service: ServiceType;
    status: TransactionStatus;
    payableMinor: number;
    createdAt: string;
  }>;
  recentFundings: Array<{ reference: string; amountMinor: number; status: FundingStatus; createdAt: string }>;
}

export interface AdminPlan {
  id: string;
  service: ServiceType;
  network: string | null;
  name: string;
  providerPlanId: string;
  category?: string | null;
  categoryLabel?: string | null;
  costMinor: number;
  sellingPriceMinor: number;
  enabled: boolean;
  isSandbox: boolean;
  syncedAt: string;
  metadata?: Record<string, unknown>;
}

/** Raw plan document returned by the admin catalogue endpoint. */
export interface AdminPlanRaw extends Omit<AdminPlan, 'id'> {
  _id: string;
}

export interface ProviderInfo {
  key: string;
  name: string;
  kind: 'VTU' | 'PAYMENT';
  adapter?: string;
  enabled: boolean;
  isSandbox: boolean;
  health: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  lastCheckedAt: string | null;
  lastError: string | null;
  errorCount?: number;
}

export type ServiceRouteKey = 'AIRTIME' | 'DATA' | 'ELECTRICITY' | 'CABLE';
export type SwitchableProviderKey = 'sme' | 'maskawasub';

export interface ProviderRouteOption {
  key: SwitchableProviderKey;
  name: string;
  configured: boolean;
  purchasable: boolean;
  reason?: string;
}

export interface ProviderServiceRoute {
  service: ServiceRouteKey;
  current: string;
  toggleable: boolean;
  fixed: boolean;
  purchasable: boolean;
  options: ProviderRouteOption[];
}

export interface ProviderRouteSwitchResult {
  service: 'AIRTIME' | 'DATA';
  provider: SwitchableProviderKey;
  previous: SwitchableProviderKey;
  changed: boolean;
  purchasable: boolean;
  routes: Partial<Record<ServiceRouteKey, string>>;
  serviceRoutes: ProviderServiceRoute[];
  sync: {
    counts: Record<string, number>;
    providers: Array<{ provider: string; services: string[]; errors: string[] }>;
  } | null;
}

export interface AuditLog {
  _id: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  createdAt: string;
}

export interface SystemSettings {
  branding: PublicSettings['branding'];
  support: PublicSettings['support'];
  manualFunding: ManualFundingSettings;
  maintenance: { enabled: boolean; message: string; allowAdmins: boolean };
  registration: { enabled: boolean; requirePhoneVerification: boolean; allowReferrals: boolean };
  limits: Record<string, number>;
  discounts: { airtimePercent: Record<string, number>; serviceFeePercent: number };
  pricing: { dataMarkupPercent: number; cableMarkupPercent: number; electricityFeeMinor: number; cableFeeMinor: number; preserveManualPlanPricing: boolean };
  providerRouting: { airtimeProvider: string; dataProvider: string };
  referrals: { enabled: boolean; rewardMinor: number; qualifyingPurchaseMinor: number; maxReferralsPerUser: number };
  notifications: { emailOnPurchase: boolean; emailOnFunding: boolean; smsOnPurchase: boolean };
}

export interface ReconciliationResult {
  checked: number;
  discrepancies: Array<{ userId: string; recordedMinor: number; computedMinor: number; differenceMinor: number }>;
  snapshot: {
    walletCount: number;
    ledgerCount: number;
    pendingTransactions: number;
    transactionsInReview: number;
    fundingsInReview: number;
    environment: { nodeEnv: string; mongoTransactions: boolean };
  };
}
