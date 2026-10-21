import { ServiceType } from '../config/constants';

export interface ProviderNetwork {
  code: string;
  name: string;
}

export interface ProviderDataPlan {
  providerPlanId: string;
  network: string;
  name: string;
  dataVolume: string;
  validity: string;
  /** Raw provider plan family (for example SME, Corporate, Gifting). */
  planType?: string;
  costMinor: number;
}

export interface ProviderDisco {
  code: string;
  name: string;
  /** Numeric/opaque ID used by the provider in validation and purchase calls. */
  providerId?: string;
}

export interface ProviderCableNetwork {
  code: string;
  name: string;
  /** Numeric/opaque ID used by the provider in validation and purchase calls. */
  providerNetworkId?: string;
}

export interface ProviderCablePackage {
  providerPlanId: string;
  network: string;
  name: string;
  validity: string;
  costMinor: number;
  /** Provider's cable-network ID (for example MaskawaSub GOTV=1). */
  providerNetworkId?: string;
}

export interface MeterValidation {
  valid: boolean;
  customerName?: string;
  customerAddress?: string;
  meterType?: 'PREPAID' | 'POSTPAID';
  isSandbox: boolean;
  message?: string;
}

export interface SmartcardValidation {
  valid: boolean;
  customerName?: string;
  isSandbox: boolean;
  message?: string;
}

export interface ProviderPurchaseRequest {
  reference: string;
  service: ServiceType;
  network?: string;
  phone?: string;
  planCode?: string;
  amountMinor?: number;
  meterNumber?: string;
  meterType?: 'PREPAID' | 'POSTPAID';
  disco?: string;
  smartcardNumber?: string;
  cableProvider?: string;
  packageCode?: string;
}

export type ProviderOutcome = 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNCERTAIN';

export interface ProviderPurchaseResult {
  outcome: ProviderOutcome;
  providerReference?: string;
  providerStatus?: string;
  message?: string;
  token?: string;
  units?: string;
  customerName?: string;
  customerAddress?: string;
  raw?: unknown;
}

export interface ProviderStatusResult {
  outcome: ProviderOutcome;
  providerReference?: string;
  providerStatus?: string;
  message?: string;
  token?: string;
  units?: string;
  customerName?: string;
  customerAddress?: string;
  raw?: unknown;
}

export interface VtuProvider {
  readonly key: string;
  readonly name: string;
  readonly isSandbox: boolean;
  /** Services this adapter can actually fulfil, not merely list. */
  readonly supportedServices: readonly ServiceType[];

  /**
   * Throws when a live purchase must not be attempted (for example an adapter
   * whose purchase contract has not been certified). Called before any wallet
   * debit so an uncertified provider can never leave customer funds reserved.
   */
  assertCanPurchase(service: ServiceType): void;

  getNetworks(): Promise<ProviderNetwork[]>;
  getDataPlans(network?: string): Promise<ProviderDataPlan[]>;
  getElectricityProviders(): Promise<ProviderDisco[]>;
  getCableProviders(): Promise<ProviderCableNetwork[]>;
  getCablePackages(network: string): Promise<ProviderCablePackage[]>;
  validateMeter(input: {
    disco: string;
    meterNumber: string;
    meterType: 'PREPAID' | 'POSTPAID';
  }): Promise<MeterValidation>;
  validateSmartcard(input: {
    provider: string;
    smartcardNumber: string;
  }): Promise<SmartcardValidation>;
  /** Must never be retried automatically. */
  purchase(request: ProviderPurchaseRequest): Promise<ProviderPurchaseResult>;
  queryStatus(reference: string): Promise<ProviderStatusResult>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}
