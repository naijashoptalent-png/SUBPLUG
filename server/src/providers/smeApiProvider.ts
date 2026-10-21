import axios, { AxiosError, AxiosInstance } from 'axios';
import { readFileSync } from 'fs';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';
import { formatNaira, nairaToMinor } from '../utils/money';
import { sanitizeProviderPayload } from '../utils/redact';
import {
  MeterValidation,
  ProviderCableNetwork,
  ProviderCablePackage,
  ProviderDataPlan,
  ProviderDisco,
  ProviderNetwork,
  ProviderOutcome,
  ProviderPurchaseRequest,
  ProviderPurchaseResult,
  ProviderStatusResult,
  SmartcardValidation,
  VtuProvider,
} from './types';

/**
 * SME API (https://smeapi.com.ng) live VTU adapter.
 *
 * The provider documents purchase, verification, data-plan, balance and
 * transaction-status endpoints. Airtime and data are fully enabled here.
 * Cable/electricity require the numeric provider and plan IDs enabled on the
 * SME API account; those are loaded from VTU_CATALOGUE_FILE so they are never
 * guessed or silently replaced with demo IDs.
 */

// Numeric network IDs confirmed against the live SME API. 9mobile is
// intentionally absent: its ID has not been confirmed, and guessing it could
// route a real purchase to the wrong network. Add it only after provider
// confirmation (and a live test) so the adapter fails closed by default.
const NETWORK_IDS: Record<string, number> = {
  MTN: 1,
  GLO: 2,
  AIRTEL: 4,
};

const NETWORK_NAMES: Record<number, string> = {
  1: 'MTN',
  2: 'GLO',
  4: 'AIRTEL',
};

const NETWORKS: ProviderNetwork[] = [
  { code: 'MTN', name: 'MTN' },
  { code: 'AIRTEL', name: 'Airtel' },
  { code: 'GLO', name: 'Glo' },
];

const PATHS = {
  user: '/api/user/',
  dataPlans: '/api/dataplans/',
  airtime: '/api/airtime/',
  data: '/api/data/',
  cableVerify: '/api/cabletv/verify/',
  cable: '/api/cabletv/',
  electricityVerify: '/api/electricity/verify/',
  electricity: '/api/electricity/',
  status: '/api/status/',
} as const;

export interface CableProviderConfig {
  code: string;
  name: string;
  providerId: string;
}

export interface CablePackageConfig {
  providerPlanId: string;
  network: string;
  name: string;
  validity: string;
  costNaira: number;
}

export interface ElectricityProviderConfig {
  code: string;
  name: string;
  providerId: string;
}

export interface SmeCatalogueConfig {
  cableProviders: CableProviderConfig[];
  cablePackages: CablePackageConfig[];
  electricityProviders: ElectricityProviderConfig[];
}

const EMPTY_CATALOGUE: SmeCatalogueConfig = {
  cableProviders: [],
  cablePackages: [],
  electricityProviders: [],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normaliseStatus(value: unknown): ProviderOutcome | null {
  if (typeof value !== 'string') return null;
  const status = value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (!status) return null;
  if (['success', 'successful', 'completed', 'complete', 'delivered', 'done', 'approved', 'credit'].includes(status)) {
    return 'SUCCESS';
  }
  if (['failed', 'failure', 'fail', 'declined', 'rejected', 'cancelled', 'canceled', 'reversed', 'refunded', 'error'].includes(status)) {
    return 'FAILED';
  }
  if (['pending', 'processing', 'in progress', 'initiated', 'queued', 'awaiting', 'awaiting confirmation'].includes(status)) {
    return 'PENDING';
  }
  if (['uncertain', 'unknown', 'timeout', 'timed out'].includes(status)) {
    return 'UNCERTAIN';
  }
  return null;
}

export function normaliseSmeOutcome(
  body: unknown,
  options: { allowGenericStatus?: boolean } = {}
): ProviderOutcome {
  const root = asRecord(body);
  const data = asRecord(root.data);
  const transaction = asRecord(root.transaction);
  const dataTransaction = asRecord(data.transaction);
  const statuses: unknown[] = [
    firstDefined(root.transaction_status, root.transactionStatus),
    firstDefined(root.Status, root.status_code, root.transactionState),
    firstDefined(transaction.status, transaction.Status, transaction.transaction_status),
    firstDefined(data.transaction_status, data.transactionStatus),
    firstDefined(data.Status, data.status_code),
    firstDefined(dataTransaction.status, dataTransaction.Status, dataTransaction.transaction_status),
    firstDefined(root.outcome, data.outcome),
    firstDefined(data.status),
  ];
  // For a purchase call, the top-level `status` is usually the transaction
  // result. For a status query it can merely mean "the lookup succeeded", so
  // callers can exclude it and require an explicit transaction state.
  if (options.allowGenericStatus !== false) {
    statuses.push(firstDefined(root.status));
  }

  const outcomes = new Set<ProviderOutcome>();
  for (const value of statuses) {
    const outcome = normaliseStatus(value);
    if (outcome) outcomes.add(outcome);
  }

  if (root.success === true || data.success === true) outcomes.add('SUCCESS');
  if (root.success === false || data.success === false) outcomes.add('FAILED');

  const message = String(firstDefined(root.message, root.msg, data.message, data.msg) ?? '');
  if (outcomes.size === 0 && /\b(success(?:ful)?|completed|delivered)\b/i.test(message)) {
    outcomes.add('SUCCESS');
  }
  if (/\b(pending|processing|awaiting|in progress)\b/i.test(message)) outcomes.add('PENDING');
  if (/\b(failed|declined|rejected|could not|not successful|invalid)\b/i.test(message)) outcomes.add('FAILED');

  if (outcomes.size === 0) return 'UNCERTAIN';
  if (outcomes.has('FAILED') && outcomes.has('SUCCESS')) return 'UNCERTAIN';
  if (outcomes.has('FAILED')) return 'FAILED';
  if (outcomes.has('PENDING')) return 'PENDING';
  if (outcomes.has('SUCCESS')) return 'SUCCESS';
  return 'UNCERTAIN';
}

function extractIdentifier(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || undefined;
  }
  return undefined;
}

function extractToken(root: Record<string, unknown>, data: Record<string, unknown>): string | undefined {
  const direct = firstDefined(
    root.token,
    root.Token,
    root.electricity_token,
    root.electricityToken,
    data.token,
    data.Token,
    data.electricity_token,
    data.electricityToken
  );
  const identifier = extractIdentifier(direct);
  if (identifier) return identifier;

  const description = String(firstDefined(root.plan_description, data.plan_description, root.message, data.message) ?? '');
  const match = description.match(/\btoken\s*[:=-]?\s*([A-Z0-9][A-Z0-9-]{6,})/i);
  return match?.[1];
}

export function normaliseSmePurchase(
  body: unknown,
  fallbackReference?: string,
  options: { allowGenericStatus?: boolean } = {}
): ProviderPurchaseResult {
  const root = asRecord(body);
  const data = asRecord(root.data);
  const transaction = asRecord(root.transaction);
  const dataTransaction = asRecord(data.transaction);
  const outcome = normaliseSmeOutcome(body, options);
  const rawStatus = firstDefined(
    extractIdentifier(root.transaction_status),
    extractIdentifier(root.Status),
    extractIdentifier(root.status),
    extractIdentifier(data.Status),
    extractIdentifier(data.status)
  );
  const message = firstDefined(
    extractIdentifier(root.message),
    extractIdentifier(root.msg),
    extractIdentifier(data.message),
    extractIdentifier(data.msg)
  );

  return {
    outcome,
    providerReference: firstDefined(
      extractIdentifier(root.ref),
      extractIdentifier(root.reference),
      extractIdentifier(root.transaction_ref),
      extractIdentifier(root.transactionRef),
      extractIdentifier(root.ReferenceID),
      extractIdentifier(transaction.ref),
      extractIdentifier(transaction.reference),
      extractIdentifier(data.ref),
      extractIdentifier(data.reference),
      extractIdentifier(data.transaction_ref),
      extractIdentifier(data.transactionRef),
      extractIdentifier(dataTransaction.ref),
      extractIdentifier(dataTransaction.reference),
      fallbackReference
    ),
    providerStatus: rawStatus ?? outcome,
    message,
    token: extractToken(root, data),
    units: firstDefined(
      extractIdentifier(root.units),
      extractIdentifier(root.Unit),
      extractIdentifier(root.unit),
      extractIdentifier(data.units),
      extractIdentifier(data.Unit),
      extractIdentifier(data.unit)
    ),
    customerName: firstDefined(
      extractIdentifier(root.customer_name),
      extractIdentifier(root.Customer_Name),
      extractIdentifier(root.customerName),
      extractIdentifier(data.customer_name),
      extractIdentifier(data.Customer_Name),
      extractIdentifier(data.customerName),
      extractIdentifier(data.name)
    ),
    customerAddress: firstDefined(
      extractIdentifier(root.customer_address),
      extractIdentifier(root.Customer_Address),
      extractIdentifier(root.address),
      extractIdentifier(data.customer_address),
      extractIdentifier(data.Customer_Address),
      extractIdentifier(data.address)
    ),
    raw: sanitizeProviderPayload(body),
  };
}

export function parseSmeDataPlans(body: unknown): ProviderDataPlan[] {
  const root = asRecord(body);
  if (normaliseStatus(root.status) !== 'SUCCESS' || !Array.isArray(root.data)) {
    throw AppError.serviceUnavailable(
      String(firstDefined(root.message, root.msg) ?? 'SME API returned an invalid data-plan response'),
      'VTU_PROVIDER_ERROR'
    );
  }

  const plans: ProviderDataPlan[] = [];
  for (const item of root.data) {
    const plan = asRecord(item);
    const id = extractIdentifier(plan.id);
    const networkId = Number(plan.network_id);
    const network = NETWORK_NAMES[networkId] ?? String(plan.network ?? '').toUpperCase();
    if (!id || !network) continue;
    const cost = Number(plan.price);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    const volume = String(plan.name ?? '').trim() || 'Data plan';
    const type = String(plan.type ?? '').trim();
    const validity = String(plan.days ?? '').trim();
    plans.push({
      providerPlanId: id,
      network,
      // Keep the provider family in planType for grouping. The display name is
      // the bundle volume only, so provider branding never leaks to customers.
      name: volume,
      dataVolume: volume,
      validity,
      planType: type || undefined,
      costMinor: nairaToMinor(cost),
    });
  }
  return plans;
}

function parseCatalogueFile(file: string): SmeCatalogueConfig {
  const resolved = path.resolve(process.cwd(), file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolved, 'utf8'));
  } catch (error) {
    throw new Error(
      `Could not read VTU_CATALOGUE_FILE at ${resolved}. ${error instanceof Error ? error.message : 'Invalid JSON'}`
    );
  }
  const root = asRecord(parsed);
  const cableProviders = Array.isArray(root.cableProviders) ? root.cableProviders : [];
  const cablePackages = Array.isArray(root.cablePackages) ? root.cablePackages : [];
  const electricityProviders = Array.isArray(root.electricityProviders) ? root.electricityProviders : [];

  return {
    cableProviders: cableProviders
      .map((item) => asRecord(item))
      .filter((item) => item.code && item.providerId)
      .map((item) => ({
        code: String(item.code).toUpperCase(),
        name: String(item.name ?? item.code),
        providerId: String(item.providerId),
      })),
    cablePackages: cablePackages
      .map((item) => asRecord(item))
      .filter((item) => item.providerPlanId && item.network && item.costNaira !== undefined)
      .map((item) => ({
        providerPlanId: String(item.providerPlanId),
        network: String(item.network).toUpperCase(),
        name: String(item.name ?? item.providerPlanId),
        validity: String(item.validity ?? ''),
        costNaira: Number(item.costNaira),
      }))
      .filter((item) => Number.isFinite(item.costNaira) && item.costNaira > 0),
    electricityProviders: electricityProviders
      .map((item) => asRecord(item))
      .filter((item) => item.code && item.providerId)
      .map((item) => ({
        code: String(item.code).toUpperCase(),
        name: String(item.name ?? item.code),
        providerId: String(item.providerId),
      })),
  };
}

/**
 * SME API expects a local 11-digit Nigerian phone number (for example
 * `08031234567`), not the internal E.164 format (`+2348031234567`).
 */
export function toSmePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  let local = digits;
  if (digits.startsWith('234') && digits.length === 13) local = digits.slice(3);
  else if (digits.startsWith('0') && digits.length === 11) local = digits.slice(1);
  if (!/^[789][01]\d{8}$/.test(local)) {
    throw AppError.badRequest('Recipient phone must be a valid Nigerian phone number', 'INVALID_PHONE');
  }
  return `0${local}`;
}

export class SmeApiProvider implements VtuProvider {
  readonly key = 'sme';
  readonly name = 'SME API';
  readonly isSandbox = false;
  readonly supportedServices = ['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE'] as const;

  assertCanPurchase(): void {
    // SME is a live, contracted provider. Individual service availability is
    // enforced by its catalogue (cable/electricity IDs are config-driven).
  }

  private readonly client: AxiosInstance;
  private readonly catalogue: SmeCatalogueConfig;
  private dataPlanCache: { value: ProviderDataPlan[]; expiresAt: number } | null = null;

  constructor() {
    if (!env.VTU_API_BASE_URL || !env.VTU_API_KEY) {
      throw AppError.serviceUnavailable(
        'The selected VTU provider is not configured.',
        'VTU_NOT_CONFIGURED'
      );
    }
    this.client = axios.create({
      baseURL: env.VTU_API_BASE_URL.replace(/\/+$/, ''),
      timeout: env.VTU_TIMEOUT_MS,
      headers: {
        Authorization: `Token ${env.VTU_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    this.catalogue = env.VTU_CATALOGUE_FILE ? parseCatalogueFile(env.VTU_CATALOGUE_FILE) : EMPTY_CATALOGUE;
  }

  private async getJson(pathname: string): Promise<unknown> {
    try {
      const response = await this.client.get(pathname);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error(
        {
          status: axiosError.response?.status,
          path: pathname,
          providerResponse: sanitizeProviderPayload(axiosError.response?.data),
        },
        'SME API request failed'
      );
      throw AppError.serviceUnavailable(
        'The VTU service is temporarily unavailable. Please try again.',
        'VTU_UNAVAILABLE'
      );
    }
  }

  private async postJson(pathname: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.client.post(pathname, payload);
    return response.data;
  }

  private networkId(network?: string): number {
    const id = network ? NETWORK_IDS[network.toUpperCase()] : undefined;
    if (!id) throw AppError.badRequest('Unsupported network', 'INVALID_NETWORK');
    return id;
  }

  private electricityProvider(code: string): ElectricityProviderConfig | undefined {
    return this.catalogue.electricityProviders.find((provider) => provider.code === code.toUpperCase());
  }

  private cableProvider(code: string): CableProviderConfig | undefined {
    return this.catalogue.cableProviders.find((provider) => provider.code === code.toUpperCase());
  }

  async getNetworks(): Promise<ProviderNetwork[]> {
    return NETWORKS;
  }

  async getDataPlans(network?: string): Promise<ProviderDataPlan[]> {
    if (!this.dataPlanCache || this.dataPlanCache.expiresAt <= Date.now()) {
      const body = await this.getJson(PATHS.dataPlans);
      const plans = parseSmeDataPlans(body);
      this.dataPlanCache = { value: plans, expiresAt: Date.now() + 60_000 };
    }
    const filtered = network
      ? this.dataPlanCache.value.filter((plan) => plan.network === network.toUpperCase())
      : this.dataPlanCache.value;
    return filtered.map((plan) => ({ ...plan }));
  }

  async getElectricityProviders(): Promise<ProviderDisco[]> {
    return this.catalogue.electricityProviders.map(({ code, name }) => ({ code, name }));
  }

  async getCableProviders(): Promise<ProviderCableNetwork[]> {
    return this.catalogue.cableProviders.map(({ code, name }) => ({ code, name }));
  }

  async getCablePackages(network: string): Promise<ProviderCablePackage[]> {
    return this.catalogue.cablePackages
      .filter((plan) => plan.network === network.toUpperCase())
      .map((plan) => ({
        providerPlanId: plan.providerPlanId,
        network: plan.network,
        name: plan.name,
        validity: plan.validity,
        costMinor: nairaToMinor(plan.costNaira),
      }));
  }

  async validateMeter(input: {
    disco: string;
    meterNumber: string;
    meterType: 'PREPAID' | 'POSTPAID';
  }): Promise<MeterValidation> {
    const provider = this.electricityProvider(input.disco);
    if (!provider) {
      return {
        valid: false,
        isSandbox: false,
        message: 'This electricity provider is not available.',
      };
    }

    let body: unknown;
    try {
      body = await this.postJson(PATHS.electricityVerify, {
        provider: provider.providerId,
        meternumber: input.meterNumber,
        metertype: input.meterType.toLowerCase(),
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      const message = String(
        firstDefined(asRecord(axiosError.response?.data).msg, asRecord(axiosError.response?.data).message, axiosError.message) ??
          'Meter could not be validated'
      );
      logger.warn({ disco: input.disco, status: axiosError.response?.status }, 'SME meter validation failed');
      return { valid: false, isSandbox: false, message };
    }

    const root = asRecord(body);
    const data = asRecord(root.data);
    const valid = normaliseSmeOutcome(body) === 'SUCCESS';
    return {
      valid,
      customerName: firstDefined(
        extractIdentifier(root.Customer_Name),
        extractIdentifier(root.customer_name),
        extractIdentifier(data.Customer_Name),
        extractIdentifier(data.customer_name)
      ),
      customerAddress: firstDefined(
        extractIdentifier(root.customer_address),
        extractIdentifier(root.Customer_Address),
        extractIdentifier(root.address),
        extractIdentifier(data.customer_address),
        extractIdentifier(data.address)
      ),
      meterType: input.meterType,
      isSandbox: false,
      message: valid
        ? undefined
        : String(firstDefined(root.msg, root.message, data.msg, data.message) ?? 'Meter could not be validated'),
    };
  }

  async validateSmartcard(input: { provider: string; smartcardNumber: string }): Promise<SmartcardValidation> {
    const provider = this.cableProvider(input.provider);
    if (!provider) {
      return {
        valid: false,
        isSandbox: false,
        message: 'This cable provider is not available.',
      };
    }

    let body: unknown;
    try {
      body = await this.postJson(PATHS.cableVerify, {
        provider: provider.providerId,
        iucnumber: input.smartcardNumber,
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      const message = String(
        firstDefined(asRecord(axiosError.response?.data).msg, asRecord(axiosError.response?.data).message, axiosError.message) ??
          'Smartcard could not be validated'
      );
      logger.warn({ provider: input.provider, status: axiosError.response?.status }, 'SME smartcard validation failed');
      return { valid: false, isSandbox: false, message };
    }

    const root = asRecord(body);
    const data = asRecord(root.data);
    const valid = normaliseSmeOutcome(body) === 'SUCCESS';
    return {
      valid,
      customerName: firstDefined(
        extractIdentifier(root.Customer_Name),
        extractIdentifier(root.customer_name),
        extractIdentifier(data.Customer_Name),
        extractIdentifier(data.customer_name)
      ),
      isSandbox: false,
      message: valid
        ? undefined
        : String(firstDefined(root.msg, root.message, data.msg, data.message) ?? 'Smartcard could not be validated'),
    };
  }

  private async executePurchase(pathname: string, payload: Record<string, unknown>, reference: string): Promise<ProviderPurchaseResult> {
    try {
      const body = await this.postJson(pathname, payload);
      return normaliseSmePurchase(body, reference);
    } catch (error) {
      const axiosError = error as AxiosError;
      const responseBody = axiosError.response?.data;
      const message = String(
        firstDefined(
          asRecord(responseBody).msg,
          asRecord(responseBody).message,
          asRecord(asRecord(responseBody).data).message,
          axiosError.message
        ) ?? 'Provider request failed without a definitive outcome'
      );
      const httpStatus = axiosError.response?.status;
      logger.error(
        {
          status: httpStatus,
          path: pathname,
          reference,
          providerResponse: sanitizeProviderPayload(responseBody),
        },
        'SME API purchase request failed'
      );

      if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
        if (/duplicate|already (?:exists|used|processed)|same ref/i.test(message)) {
          return {
            outcome: 'UNCERTAIN',
            providerReference: reference,
            providerStatus: 'DUPLICATE_REFERENCE',
            message,
            raw: sanitizeProviderPayload(responseBody),
          };
        }
        // A 400/422 is a rejected request: the provider did not create a
        // transaction, so refunding is safer than holding funds for review.
        if (httpStatus === 400 || httpStatus === 422) {
          return {
            outcome: 'FAILED',
            providerReference: reference,
            providerStatus: `HTTP_${httpStatus}`,
            message,
            raw: sanitizeProviderPayload(responseBody),
          };
        }
        if (/invalid|not found|insufficient|declined|rejected|disabled|failed|could not/i.test(message)) {
          return {
            outcome: 'FAILED',
            providerReference: reference,
            providerStatus: `HTTP_${httpStatus}`,
            message,
            raw: sanitizeProviderPayload(responseBody),
          };
        }
      }

      return {
        outcome: 'UNCERTAIN',
        providerReference: reference,
        providerStatus: httpStatus ? `HTTP_${httpStatus}` : 'REQUEST_FAILED',
        message: 'The provider did not return a definitive result. No automatic retry was made.',
        raw: sanitizeProviderPayload(responseBody),
      };
    }
  }

  async purchase(request: ProviderPurchaseRequest): Promise<ProviderPurchaseResult> {
    if (request.service === 'AIRTIME') {
      const network = this.networkId(request.network);
      if (!request.phone) throw AppError.badRequest('Recipient phone is required', 'INVALID_PHONE');
      const phone = toSmePhone(request.phone);
      if (!request.amountMinor || request.amountMinor % 100 !== 0) {
        throw AppError.badRequest('Airtime amount must be a whole Naira value', 'INVALID_AMOUNT');
      }
      return this.executePurchase(
        PATHS.airtime,
        {
          network,
          amount: request.amountMinor / 100,
          phone,
          ported_number: 'false',
          ref: request.reference,
        },
        request.reference
      );
    }

    if (request.service === 'DATA') {
      const network = this.networkId(request.network);
      if (!request.phone) throw AppError.badRequest('Recipient phone is required', 'INVALID_PHONE');
      const phone = toSmePhone(request.phone);
      const planId = request.planCode ?? request.packageCode;
      if (!planId || !/^\d+$/.test(String(planId))) {
        throw AppError.badRequest('A valid data plan is required.', 'INVALID_PLAN');
      }
      return this.executePurchase(
        PATHS.data,
        {
          network,
          data_plan: Number(planId),
          phone,
          ported_number: 'false',
          ref: request.reference,
        },
        request.reference
      );
    }

    if (request.service === 'ELECTRICITY') {
      const disco = request.disco ?? '';
      const provider = this.electricityProvider(disco);
      if (!provider) throw AppError.badRequest('This electricity provider is not configured', 'INVALID_DISCO');
      if (!request.meterNumber || !request.meterType) {
        throw AppError.badRequest('Meter number and type are required', 'INVALID_METER');
      }
      if (!request.amountMinor || request.amountMinor < 100) {
        throw AppError.badRequest('Electricity amount is invalid', 'INVALID_AMOUNT');
      }
      const phone = toSmePhone(request.phone ?? '');
      return this.executePurchase(
        PATHS.electricity,
        {
          provider: provider.providerId,
          metertype: request.meterType.toLowerCase(),
          meternumber: request.meterNumber,
          amount: request.amountMinor / 100,
          phone,
          ref: request.reference,
        },
        request.reference
      );
    }

    const cableProvider = request.cableProvider ?? '';
    const provider = this.cableProvider(cableProvider);
    if (!provider) throw AppError.badRequest('This cable provider is not configured', 'INVALID_CABLE_PROVIDER');
    const planCode = request.packageCode ?? request.planCode;
    const packageConfig = this.catalogue.cablePackages.find(
      (plan) => plan.providerPlanId === planCode && plan.network === cableProvider.toUpperCase()
    );
    if (!planCode || !packageConfig) {
      throw AppError.badRequest('This cable package is not configured', 'INVALID_PLAN');
    }
    if (!request.smartcardNumber) throw AppError.badRequest('Smartcard number is required', 'INVALID_SMARTCARD');
    const phone = toSmePhone(request.phone ?? '');

    return this.executePurchase(
      PATHS.cable,
      {
        provider: provider.providerId,
        iucnumber: request.smartcardNumber,
        phone,
        plan: /^\d+$/.test(packageConfig.providerPlanId)
          ? Number(packageConfig.providerPlanId)
          : packageConfig.providerPlanId,
        ref: request.reference,
      },
      request.reference
    );
  }

  async queryStatus(reference: string): Promise<ProviderStatusResult> {
    try {
      const body = await this.postJson(PATHS.status, { ref: reference });
      // A successful lookup is not the same as a successful transaction. Only
      // an explicit transaction state (or a decisive message) may resolve it.
      return normaliseSmePurchase(body, reference, { allowGenericStatus: false });
    } catch (error) {
      const axiosError = error as AxiosError;
      const httpStatus = axiosError.response?.status;
      const responseBody = axiosError.response?.data;
      const message = String(
        firstDefined(asRecord(responseBody).msg, asRecord(responseBody).message, axiosError.message) ??
          'Provider status could not be checked'
      );
      logger.warn({ reference, status: httpStatus }, 'SME API status query failed');
      if (httpStatus === 404) {
        return {
          outcome: 'UNCERTAIN',
          providerReference: reference,
          providerStatus: 'NOT_FOUND',
          message:
            'The provider has no record of this reference yet. Funds remain reserved for manual reconciliation.',
          raw: sanitizeProviderPayload(responseBody),
        };
      }
      if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
        return {
          outcome: 'UNCERTAIN',
          providerReference: reference,
          providerStatus: `HTTP_${httpStatus}`,
          message,
          raw: sanitizeProviderPayload(responseBody),
        };
      }
      throw AppError.serviceUnavailable('Status check failed. Try again later.', 'STATUS_CHECK_FAILED');
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const body = await this.getJson(PATHS.user);
      const root = asRecord(body);
      if (normaliseStatus(root.status) !== 'SUCCESS') {
        return { healthy: false, message: String(firstDefined(root.msg, root.message) ?? 'SME API health check failed') };
      }
      const balance = Number(root.balance);
      if (!Number.isFinite(balance)) {
        return { healthy: false, message: 'SME API did not return a wallet balance' };
      }
      return {
        healthy: true,
        message: `SME API reachable. Provider wallet balance: ${formatNaira(nairaToMinor(balance))}.`,
      };
    } catch (error) {
      return { healthy: false, message: error instanceof Error ? error.message : 'SME API is unreachable' };
    }
  }
}
