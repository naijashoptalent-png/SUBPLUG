import axios, { AxiosError, AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { SERVICE_TYPES, ServiceType } from '../config/constants';
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
 * MaskawaSub (https://maskawasub.com) secondary VTU adapter.
 *
 * Confirmed live read-only contracts:
 *   GET /api/user/      account snapshot, data plans and cable packages
 *   GET /api/disco/     electricity distribution companies
 *   GET /api/cable/     cable package catalogue
 *
 * Live purchases are gated by the explicit service allowlist in the
 * environment. The documented airtime/data request fields are used verbatim;
 * an unrecognised or incomplete provider response remains uncertain rather
 * than being treated as a successful delivery.
 * This adapter deliberately never reads /api/history/ or /api/sms/: those
 * endpoints returned account-wide records during probing and may contain
 * third-party personal data.
 */

const PATHS = {
  user: '/api/user/',
  disco: '/api/disco/',
  data: '/api/data/',
  airtime: '/api/topup/',
  cable: '/api/cablesub/',
  electricity: '/api/billpayment/',
  validateMeter: '/api/validatemeter/',
  validateIuc: '/api/validateiuc/',
} as const;

const NETWORK_IDS: Record<string, number> = {
  MTN: 1,
  GLO: 2,
  '9MOBILE': 3,
  AIRTEL: 4,
};

const NETWORK_NAMES: Record<number, string> = {
  1: 'MTN',
  2: 'GLO',
  3: '9MOBILE',
  4: 'AIRTEL',
};

const NETWORKS: ProviderNetwork[] = [
  { code: 'MTN', name: 'MTN' },
  { code: 'AIRTEL', name: 'Airtel' },
  { code: 'GLO', name: 'Glo' },
  { code: '9MOBILE', name: '9mobile' },
];

const CABLE_GROUP_NAMES: Record<string, string> = {
  GOTVPLAN: 'GOTV',
  DSTVPLAN: 'DSTV',
  STARTIMEPLAN: 'STARTIMES',
};

const CABLE_DISPLAY_NAMES: Record<string, string> = {
  GOTV: 'GOtv',
  DSTV: 'DStv',
  STARTIMES: 'StarTimes',
};

/**
 * Parses the per-service certification allowlist. Unknown values are ignored
 * so a typo can never silently enable a service.
 */
export function parseMaskawaCertifiedServices(value: string): Set<ServiceType> {
  const known = new Set<string>(SERVICE_TYPES);
  return new Set(
    value
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter((item): item is ServiceType => known.has(item))
  );
}

const DISCO_CODE_OVERRIDES: Record<string, string> = {
  'ikeja electric': 'IKEJA',
  'eko electric': 'EKO',
  'abuja electric': 'ABUJA',
  'kano electric': 'KANO',
  'enugu electric': 'ENUGU',
  'port harcourt electric': 'PH',
  'ibadan electric': 'IBADAN',
  'kaduna electric': 'KADUNA',
  'jos electric': 'JOS',
  'benin electric': 'BENIN',
  'yola electric': 'YOLA',
};

/** MaskawaSub's own catalogue contains a few obvious data-entry errors. */
const MAX_PLAUSIBLE_NAIRA = 1_000_000;
const MIN_PLAUSIBLE_NAIRA = 1;

const EMPTY_PURCHASE_RESPONSE = 'MaskawaSub returned no purchase response';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function extractIdentifier(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || undefined;
  }
  return undefined;
}

/**
 * Keeps a compact, safe explanation from a provider validation response.
 * MaskawaSub commonly returns field-error objects for HTTP 400 responses;
 * without this, customers only see Axios's generic status-code message.
 */
export function extractMaskawaErrorMessage(value: unknown): string | undefined {
  const root = asRecord(sanitizeProviderPayload(value));
  const direct = firstDefined(root.message, root.msg, root.detail, root.error);
  if (typeof direct === 'string' && direct.trim()) return direct.trim().slice(0, 300);

  const nestedErrors = asRecord(firstDefined(root.errors, root.error, root.data));
  const errors = Object.keys(nestedErrors).length ? nestedErrors : root;
  const parts: string[] = [];
  for (const [field, raw] of Object.entries(errors)) {
    // Never surface authentication or recipient identifiers in transaction
    // history/logs, even if the upstream API echoes them in an error response.
    if (/(token|key|auth|password|pin|phone|mobile|email|meter|smartcard)/i.test(field)) continue;
    const text = Array.isArray(raw) ? raw.find((item) => typeof item === 'string') : raw;
    if (typeof text === 'string' && text.trim()) parts.push(`${field}: ${text.trim()}`);
    if (parts.length === 3) break;
  }
  return parts.length ? parts.join('; ').slice(0, 300) : undefined;
}

function numericId(value: string | number | undefined): string | number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value);
  return /^\d+$/.test(text) ? Number(text) : text;
}

export function normaliseMaskawaNetwork(value: unknown): string | undefined {
  const text = String(value ?? '').trim().toUpperCase();
  if (!text) return undefined;
  if (NETWORK_IDS[text]) return text;
  const numeric = Number(text);
  if (Number.isInteger(numeric) && NETWORK_NAMES[numeric]) return NETWORK_NAMES[numeric];
  return undefined;
}

function parseAmountNaira(value: unknown): number | undefined {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < MIN_PLAUSIBLE_NAIRA || amount > MAX_PLAUSIBLE_NAIRA) return undefined;
  return amount;
}

/**
 * Parses the account snapshot's Dataplans object. Plan IDs and network IDs are
 * provider-owned values from the snapshot; nothing is fabricated. Implausible
 * prices are dropped so a malformed catalogue row can never become a price.
 */
export function parseMaskawaDataPlans(value: unknown): ProviderDataPlan[] {
  const root = asRecord(value);
  const plans: ProviderDataPlan[] = [];
  const seen = new Set<string>();

  for (const group of Object.values(root)) {
    const all = asRecord(group).ALL;
    if (!Array.isArray(all)) continue;
    for (const item of all) {
      const plan = asRecord(item);
      const providerPlanId = extractIdentifier(firstDefined(plan.id, plan.plan_id, plan.planId));
      const network = normaliseMaskawaNetwork(firstDefined(plan.plan_network, plan.network));
      const amount = parseAmountNaira(firstDefined(plan.plan_amount, plan.amount, plan.price));
      if (!providerPlanId || !network || amount === undefined) continue;

      const key = `${network}:${providerPlanId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const volume = String(firstDefined(plan.plan, plan.plan_name, plan.name) ?? '').trim();
      if (!volume) continue;
      const planType = String(firstDefined(plan.plan_type, plan.type) ?? '').trim();
      const validity = String(firstDefined(plan.month_validate, plan.validity, plan.days) ?? '').trim();

      plans.push({
        providerPlanId,
        network,
        name: volume,
        dataVolume: volume,
        validity,
        planType: planType || undefined,
        costMinor: nairaToMinor(amount),
      });
    }
  }

  return plans;
}

export interface MaskawaCableCatalogue {
  providers: ProviderCableNetwork[];
  packages: ProviderCablePackage[];
}

/**
 * Parses the account snapshot's Cableplan object. `cablename` maps the
 * provider's numeric cable-network IDs to GOTV/DSTV/STARTIME; package IDs are
 * taken verbatim from `cableplan_id`.
 */
export function parseMaskawaCableCatalogue(value: unknown): MaskawaCableCatalogue {
  const root = asRecord(value);
  const rawNames = Array.isArray(root.cablename) ? root.cablename : [];
  const codeToProviderId = new Map<string, string>();
  for (const item of rawNames) {
    const row = asRecord(item);
    const name = normaliseMaskawaCableCode(firstDefined(row.name, row.cable));
    const id = extractIdentifier(firstDefined(row.id, row.cablename_id));
    if (name && id) codeToProviderId.set(name, id);
  }

  const providers: ProviderCableNetwork[] = [];
  const packages: ProviderCablePackage[] = [];
  const seenProviders = new Set<string>();
  const seenPackages = new Set<string>();

  for (const [groupKey, groupValue] of Object.entries(root)) {
    const network = CABLE_GROUP_NAMES[groupKey.toUpperCase()];
    if (!network || !Array.isArray(groupValue)) continue;
    if (!seenProviders.has(network)) {
      seenProviders.add(network);
      providers.push({
        code: network,
        name: CABLE_DISPLAY_NAMES[network] ?? network,
        providerNetworkId: codeToProviderId.get(network),
      });
    }

    for (const item of groupValue) {
      const row = asRecord(item);
      const providerPlanId = extractIdentifier(
        firstDefined(row.cableplan_id, row.id, row.plan_id)
      );
      const amount = parseAmountNaira(firstDefined(row.plan_amount, row.amount, row.price));
      const name = String(firstDefined(row.package, row.plan, row.name) ?? '').trim();
      if (!providerPlanId || !name || amount === undefined) continue;

      // Keep the first unique package name. Provider plan IDs are never
      // inferred from the name; duplicate names are deliberately skipped.
      const key = `${network}:${name.toLowerCase()}`;
      if (seenPackages.has(key)) continue;
      seenPackages.add(key);

      packages.push({
        providerPlanId,
        network,
        name,
        validity: String(firstDefined(row.month_validate, row.validity, row.days) ?? '').trim(),
        costMinor: nairaToMinor(amount),
        providerNetworkId: codeToProviderId.get(network),
      });
    }
  }

  return { providers, packages };
}

export function normaliseMaskawaCableCode(value: unknown): string | undefined {
  const text = String(value ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (text === 'GOTV') return 'GOTV';
  if (text === 'DSTV') return 'DSTV';
  if (text === 'STARTIME' || text === 'STARTIMES') return 'STARTIMES';
  return undefined;
}

function discoCode(name: string): string {
  const key = name.trim().toLowerCase();
  if (DISCO_CODE_OVERRIDES[key]) return DISCO_CODE_OVERRIDES[key];
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'DISCO';
}

export function parseMaskawaDiscos(value: unknown): ProviderDisco[] {
  const root = asRecord(value);
  const rows = Array.isArray(root.disko)
    ? root.disko
    : Array.isArray(root.discos)
      ? root.discos
      : Array.isArray(root.data)
        ? root.data
        : [];
  const seen = new Set<string>();
  const providers: ProviderDisco[] = [];
  for (const item of rows) {
    const row = asRecord(item);
    const providerId = extractIdentifier(firstDefined(row.id, row.disco_id, row.provider_id));
    const name = String(firstDefined(row.name, row.disco, row.provider) ?? '').trim();
    if (!providerId || !name) continue;
    const code = discoCode(name);
    if (seen.has(code)) continue;
    seen.add(code);
    providers.push({ code, name, providerId });
  }
  return providers;
}

export function normaliseMaskawaOutcome(body: unknown): ProviderOutcome {
  const root = asRecord(body);
  const data = asRecord(root.data);
  const outcomes = new Set<ProviderOutcome>();

  const statuses: unknown[] = [
    firstDefined(root.status, root.Status, root.transaction_status, root.transactionStatus),
    firstDefined(root.state, root.outcome),
    firstDefined(data.status, data.Status, data.transaction_status, data.transactionStatus),
    firstDefined(data.state, data.outcome),
  ];

  for (const value of statuses) {
    if (typeof value !== 'string') continue;
    const status = value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    if (!status) continue;
    if (['success', 'successful', 'completed', 'complete', 'delivered', 'sent', 'approved', 'done'].includes(status)) {
      outcomes.add('SUCCESS');
    } else if (['failed', 'failure', 'fail', 'declined', 'rejected', 'cancelled', 'canceled', 'reversed', 'refunded', 'invalid', 'error'].includes(status)) {
      outcomes.add('FAILED');
    } else if (['pending', 'processing', 'in progress', 'initiated', 'queued', 'awaiting'].includes(status)) {
      outcomes.add('PENDING');
    } else if (['uncertain', 'unknown', 'timeout', 'timed out'].includes(status)) {
      outcomes.add('UNCERTAIN');
    }
  }

  if (root.success === true || data.success === true) outcomes.add('SUCCESS');
  if (root.success === false || data.success === false) outcomes.add('FAILED');

  const message = String(firstDefined(root.message, root.msg, data.message, data.msg) ?? '');
  if (outcomes.size === 0 && /\b(success(?:ful)?|completed|delivered|sent|approved)\b/i.test(message)) {
    outcomes.add('SUCCESS');
  }
  if (/\b(pending|processing|awaiting|in progress|queued)\b/i.test(message)) outcomes.add('PENDING');
  if (/\b(failed|declined|rejected|could not|not successful|invalid|insufficient)\b/i.test(message)) {
    outcomes.add('FAILED');
  }

  if (outcomes.size === 0) return 'UNCERTAIN';
  if (outcomes.has('FAILED') && outcomes.has('SUCCESS')) return 'UNCERTAIN';
  if (outcomes.has('FAILED')) return 'FAILED';
  if (outcomes.has('PENDING')) return 'PENDING';
  if (outcomes.has('SUCCESS')) return 'SUCCESS';
  return 'UNCERTAIN';
}

export function normaliseMaskawaPurchase(body: unknown, fallbackReference?: string): ProviderPurchaseResult {
  const root = asRecord(body);
  const data = asRecord(root.data);
  const transaction = asRecord(firstDefined(root.transaction, data.transaction));
  const outcome = normaliseMaskawaOutcome(body);
  const message = firstDefined(
    extractIdentifier(root.message),
    extractIdentifier(root.msg),
    extractIdentifier(data.message),
    extractIdentifier(data.msg),
    outcome === 'UNCERTAIN' ? EMPTY_PURCHASE_RESPONSE : undefined
  );

  const providerReference = firstDefined(
    extractIdentifier(root.ref),
    extractIdentifier(root.reference),
    extractIdentifier(root.transaction_id),
    extractIdentifier(root.transactionId),
    extractIdentifier(root.order_id),
    extractIdentifier(root.orderId),
    extractIdentifier(root.id),
    extractIdentifier(transaction.ref),
    extractIdentifier(transaction.reference),
    extractIdentifier(transaction.id),
    extractIdentifier(data.ref),
    extractIdentifier(data.reference),
    extractIdentifier(data.transaction_id),
    extractIdentifier(data.transactionId),
    extractIdentifier(data.order_id),
    extractIdentifier(data.orderId),
    extractIdentifier(data.id),
    fallbackReference
  );

  return {
    outcome,
    providerReference,
    providerStatus: extractIdentifier(
      firstDefined(root.status, root.Status, root.transaction_status, data.status, data.transaction_status)
    ) ?? outcome,
    message,
    token: extractIdentifier(
      firstDefined(
        root.token,
        root.Token,
        root.electricity_token,
        data.token,
        data.Token,
        data.electricity_token
      )
    ),
    units: extractIdentifier(firstDefined(root.units, root.Unit, root.unit, data.units, data.Unit, data.unit)),
    customerName: extractIdentifier(
      firstDefined(root.customer_name, root.Customer_Name, root.customerName, data.customer_name, data.Customer_Name, data.customerName, data.name)
    ),
    customerAddress: extractIdentifier(
      firstDefined(root.customer_address, root.Customer_Address, root.address, data.customer_address, data.Customer_Address, data.address)
    ),
    raw: sanitizeProviderPayload(body),
  };
}

export function toMaskawaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  let local = digits;
  if (digits.startsWith('234') && digits.length === 13) local = digits.slice(3);
  else if (digits.startsWith('0') && digits.length === 11) local = digits.slice(1);
  if (!/^[789][01]\d{8}$/.test(local)) {
    throw AppError.badRequest('Recipient phone must be a valid Nigerian phone number', 'INVALID_PHONE');
  }
  return `0${local}`;
}

interface MaskawaUserSnapshot {
  dataPlans: ProviderDataPlan[];
  cable: MaskawaCableCatalogue;
  balanceMinor: number | null;
  fetchedAt: number;
}

function parseBalanceMinor(root: Record<string, unknown>): number | null {
  const user = asRecord(root.user);
  const raw = firstDefined(
    user.Account_Balance,
    user.account_balance,
    user.wallet_balance,
    root.Account_Balance,
    root.account_balance
  );
  if (raw === undefined) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return null;
  return nairaToMinor(amount);
}

export class MaskawaSubProvider implements VtuProvider {
  readonly key = 'maskawasub';
  readonly name = 'MaskawaSub';
  readonly isSandbox = false;
  readonly supportedServices: ServiceType[] = ['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE'];

  private readonly client: AxiosInstance;
  private userCache: { value: MaskawaUserSnapshot; expiresAt: number } | null = null;
  private discoCache: { value: ProviderDisco[]; expiresAt: number } | null = null;

  constructor() {
    if (!env.MASKAWASUB_API_BASE_URL || !env.MASKAWASUB_API_KEY) {
      throw AppError.serviceUnavailable(
        'The selected VTU provider is not configured.',
        'VTU_NOT_CONFIGURED'
      );
    }
    this.client = axios.create({
      baseURL: env.MASKAWASUB_API_BASE_URL.replace(/\/+$/, ''),
      timeout: env.VTU_TIMEOUT_MS,
      headers: {
        Authorization: `Token ${env.MASKAWASUB_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  assertCanPurchase(service: ServiceType): void {
    if (!this.supportedServices.includes(service)) {
      throw AppError.serviceUnavailable('This service is not supported by the selected provider.', 'SERVICE_UNAVAILABLE');
    }
    if (!env.MASKAWASUB_LIVE_PURCHASES) {
      throw AppError.serviceUnavailable(
        'Live purchases are not enabled. The provider contract must be certified before customer funds are accepted.',
        'VTU_NOT_CERTIFIED'
      );
    }
    const certified = parseMaskawaCertifiedServices(env.MASKAWASUB_CERTIFIED_SERVICES);
    if (!certified.has(service)) {
      throw AppError.serviceUnavailable(
        `Live purchases are not certified for ${service}.`,
        'VTU_NOT_CERTIFIED'
      );
    }
  }

  private async getJson(pathname: string): Promise<unknown> {
    try {
      const response = await this.client.get(pathname);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      // Never log the body of /api/user/: it contains account PII.
      logger.error({ provider: this.key, status: axiosError.response?.status, path: pathname }, 'MaskawaSub read request failed');
      throw AppError.serviceUnavailable('The backup VTU provider could not be reached.', 'VTU_UNAVAILABLE');
    }
  }

  private async postJson(pathname: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.client.post(pathname, payload);
    return response.data;
  }

  private async loadUserSnapshot(force = false): Promise<MaskawaUserSnapshot> {
    if (!force && this.userCache && this.userCache.expiresAt > Date.now()) return this.userCache.value;
    const body = await this.getJson(PATHS.user);
    const root = asRecord(body);
    const snapshot: MaskawaUserSnapshot = {
      dataPlans: parseMaskawaDataPlans(root.Dataplans),
      cable: parseMaskawaCableCatalogue(root.Cableplan),
      balanceMinor: parseBalanceMinor(root),
      fetchedAt: Date.now(),
    };
    this.userCache = { value: snapshot, expiresAt: Date.now() + 60_000 };
    return snapshot;
  }

  private async loadDiscos(force = false): Promise<ProviderDisco[]> {
    if (!force && this.discoCache && this.discoCache.expiresAt > Date.now()) return this.discoCache.value;
    const body = await this.getJson(PATHS.disco);
    const providers = parseMaskawaDiscos(body);
    this.discoCache = { value: providers, expiresAt: Date.now() + 5 * 60_000 };
    return providers;
  }

  private networkId(network?: string): number {
    const id = network ? NETWORK_IDS[network.toUpperCase()] : undefined;
    if (!id) throw AppError.badRequest('Unsupported network', 'INVALID_NETWORK');
    return id;
  }

  async getNetworks(): Promise<ProviderNetwork[]> {
    const snapshot = await this.loadUserSnapshot();
    return NETWORKS.filter((network) => snapshot.dataPlans.some((plan) => plan.network === network.code));
  }

  async getDataPlans(network?: string): Promise<ProviderDataPlan[]> {
    const snapshot = await this.loadUserSnapshot();
    const filtered = network
      ? snapshot.dataPlans.filter((plan) => plan.network === network.toUpperCase())
      : snapshot.dataPlans;
    return filtered.map((plan) => ({ ...plan }));
  }

  async getElectricityProviders(): Promise<ProviderDisco[]> {
    return (await this.loadDiscos()).map((provider) => ({ ...provider }));
  }

  async getCableProviders(): Promise<ProviderCableNetwork[]> {
    const snapshot = await this.loadUserSnapshot();
    return snapshot.cable.providers.map((provider) => ({ ...provider }));
  }

  async getCablePackages(network: string): Promise<ProviderCablePackage[]> {
    const snapshot = await this.loadUserSnapshot();
    const code = normaliseMaskawaCableCode(network);
    if (!code) return [];
    return snapshot.cable.packages
      .filter((plan) => plan.network === code)
      .map((plan) => ({ ...plan }));
  }

  async validateMeter(input: {
    disco: string;
    meterNumber: string;
    meterType: 'PREPAID' | 'POSTPAID';
  }): Promise<MeterValidation> {
    const providers = await this.loadDiscos();
    const provider = providers.find((item) => item.code === input.disco.toUpperCase());
    if (!provider?.providerId) {
      return { valid: false, isSandbox: false, message: 'This electricity provider is not available from the backup provider.' };
    }

    let body: unknown;
    try {
      body = await this.postJson(PATHS.validateMeter, {
        disco: numericId(provider.providerId),
        disco_id: numericId(provider.providerId),
        provider: numericId(provider.providerId),
        meternumber: input.meterNumber,
        meter_number: input.meterNumber,
        metertype: input.meterType.toLowerCase(),
        meter_type: input.meterType.toLowerCase(),
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      const response = asRecord(axiosError.response?.data);
      const message = String(firstDefined(response.message, response.msg, axiosError.message) ?? 'Meter could not be validated');
      logger.warn({ provider: this.key, status: axiosError.response?.status }, 'MaskawaSub meter validation failed');
      return { valid: false, isSandbox: false, message };
    }

    const root = asRecord(body);
    const data = asRecord(root.data);
    const outcome = normaliseMaskawaOutcome(body);
    const message = String(firstDefined(root.message, root.msg, data.message, data.msg) ?? '');
    const customerName = firstDefined(
      extractIdentifier(root.customer_name),
      extractIdentifier(root.Customer_Name),
      extractIdentifier(data.customer_name),
      extractIdentifier(data.Customer_Name),
      extractIdentifier(data.name)
    );
    const valid = outcome === 'SUCCESS' || (Boolean(customerName) && !/invalid|failed|not found/i.test(message));

    return {
      valid,
      customerName,
      customerAddress: firstDefined(
        extractIdentifier(root.customer_address),
        extractIdentifier(root.Customer_Address),
        extractIdentifier(root.address),
        extractIdentifier(data.customer_address),
        extractIdentifier(data.Customer_Address),
        extractIdentifier(data.address)
      ),
      meterType: input.meterType,
      isSandbox: false,
      message: valid ? undefined : message || 'Meter could not be validated',
    };
  }

  async validateSmartcard(input: { provider: string; smartcardNumber: string }): Promise<SmartcardValidation> {
    const code = normaliseMaskawaCableCode(input.provider);
    const snapshot = await this.loadUserSnapshot();
    const provider = snapshot.cable.providers.find((item) => item.code === code);
    if (!provider?.providerNetworkId) {
      return { valid: false, isSandbox: false, message: 'This cable provider is not available from the backup provider.' };
    }

    let body: unknown;
    try {
      body = await this.postJson(PATHS.validateIuc, {
        cablename: numericId(provider.providerNetworkId),
        cable: code,
        iucnumber: input.smartcardNumber,
        smartcard_number: input.smartcardNumber,
        smartcard: input.smartcardNumber,
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      const response = asRecord(axiosError.response?.data);
      const message = String(firstDefined(response.message, response.msg, axiosError.message) ?? 'Smartcard could not be validated');
      logger.warn({ provider: this.key, status: axiosError.response?.status }, 'MaskawaSub smartcard validation failed');
      return { valid: false, isSandbox: false, message };
    }

    const root = asRecord(body);
    const data = asRecord(root.data);
    const outcome = normaliseMaskawaOutcome(body);
    const message = String(firstDefined(root.message, root.msg, data.message, data.msg) ?? '');
    const customerName = firstDefined(
      extractIdentifier(root.customer_name),
      extractIdentifier(root.Customer_Name),
      extractIdentifier(data.customer_name),
      extractIdentifier(data.Customer_Name),
      extractIdentifier(data.name)
    );
    const valid = outcome === 'SUCCESS' || (Boolean(customerName) && !/invalid|failed|not found/i.test(message));

    return {
      valid,
      customerName,
      isSandbox: false,
      message: valid ? undefined : message || 'Smartcard could not be validated',
    };
  }

  private async executePurchase(
    pathname: string,
    payload: Record<string, unknown>,
    reference: string
  ): Promise<ProviderPurchaseResult> {
    try {
      const body = await this.postJson(pathname, payload);
      return normaliseMaskawaPurchase(body, reference);
    } catch (error) {
      const axiosError = error as AxiosError;
      const responseBody = axiosError.response?.data;
      const response = asRecord(responseBody);
      const message = String(
        firstDefined(
          response.message,
          response.msg,
          asRecord(response.data).message,
          asRecord(response.data).msg,
          extractMaskawaErrorMessage(responseBody),
          axiosError.message
        ) ??
          'Provider request failed without a definitive outcome'
      );
      const httpStatus = axiosError.response?.status;
      logger.error(
        {
          provider: this.key,
          status: httpStatus,
          path: pathname,
          reference,
          providerResponse: sanitizeProviderPayload(responseBody),
        },
        'MaskawaSub purchase request failed'
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
        // A rejected request did not create a provider transaction, so the
        // purchase service can safely fail and refund. Timeouts and 5xx
        // responses remain uncertain and are never retried automatically.
        if (httpStatus === 400 || httpStatus === 401 || httpStatus === 403 || httpStatus === 422) {
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
        message: 'The backup provider did not return a definitive result. No automatic retry was made.',
        raw: sanitizeProviderPayload(responseBody),
      };
    }
  }

  async purchase(request: ProviderPurchaseRequest): Promise<ProviderPurchaseResult> {
    this.assertCanPurchase(request.service);

    if (request.service === 'AIRTIME') {
      const network = this.networkId(request.network);
      if (!request.phone) throw AppError.badRequest('Recipient phone is required', 'INVALID_PHONE');
      const phone = toMaskawaPhone(request.phone);
      if (!request.amountMinor || request.amountMinor % 100 !== 0) {
        throw AppError.badRequest('Airtime amount must be a whole Naira value', 'INVALID_AMOUNT');
      }
      return this.executePurchase(
        PATHS.airtime,
        {
          // MaskawaSub's published Postman collection expects exactly these
          // fields for airtime. In particular it does not accept our internal
          // `phone`, `network_id`, or idempotency-reference aliases.
          network,
          amount: request.amountMinor / 100,
          mobile_number: phone,
          Ported_number: true,
          airtime_type: 'VTU',
        },
        request.reference
      );
    }

    if (request.service === 'DATA') {
      const network = this.networkId(request.network);
      if (!request.phone) throw AppError.badRequest('Recipient phone is required', 'INVALID_PHONE');
      const phone = toMaskawaPhone(request.phone);
      const planId = request.planCode ?? request.packageCode;
      if (!planId) throw AppError.badRequest('A valid data plan is required.', 'INVALID_PLAN');
      const plan = numericId(planId);
      return this.executePurchase(
        PATHS.data,
        {
          // Matches the documented MaskawaSub /api/data/ payload.
          network,
          plan,
          mobile_number: phone,
          Ported_number: true,
        },
        request.reference
      );
    }

    if (request.service === 'ELECTRICITY') {
      const providers = await this.loadDiscos();
      const disco = providers.find((item) => item.code === (request.disco ?? '').toUpperCase());
      if (!disco?.providerId) throw AppError.badRequest('This electricity provider is not available', 'INVALID_DISCO');
      if (!request.meterNumber || !request.meterType) {
        throw AppError.badRequest('Meter number and type are required', 'INVALID_METER');
      }
      if (!request.amountMinor || request.amountMinor < 100 || request.amountMinor % 100 !== 0) {
        throw AppError.badRequest('Electricity amount is invalid', 'INVALID_AMOUNT');
      }
      const phone = toMaskawaPhone(request.phone ?? '');
      return this.executePurchase(
        PATHS.electricity,
        {
          disco: numericId(disco.providerId),
          disco_id: numericId(disco.providerId),
          meternumber: request.meterNumber,
          meter_number: request.meterNumber,
          metertype: request.meterType.toLowerCase(),
          meter_type: request.meterType.toLowerCase(),
          amount: request.amountMinor / 100,
          phone,
          ref: request.reference,
          reference: request.reference,
        },
        request.reference
      );
    }

    if (request.service !== 'CABLE') {
      throw AppError.badRequest('Unsupported service for this provider', 'SERVICE_UNAVAILABLE');
    }

    const cableCode = normaliseMaskawaCableCode(request.cableProvider);
    const snapshot = await this.loadUserSnapshot();
    const cableProvider = snapshot.cable.providers.find((item) => item.code === cableCode);
    const planCode = request.packageCode ?? request.planCode;
    const plan = snapshot.cable.packages.find(
      (item) => item.providerPlanId === planCode && item.network === cableCode
    );
    if (!cableProvider?.providerNetworkId || !plan) {
      throw AppError.badRequest('This cable package is not available', 'INVALID_PLAN');
    }
    if (!request.smartcardNumber) throw AppError.badRequest('Smartcard number is required', 'INVALID_SMARTCARD');
    const phone = toMaskawaPhone(request.phone ?? '');
    const cablePlan = numericId(plan.providerPlanId);

    return this.executePurchase(
      PATHS.cable,
      {
        cablename: numericId(cableProvider.providerNetworkId),
        cable: cableCode,
        cableplan: cablePlan,
        plan: cablePlan,
        smartcard_number: request.smartcardNumber,
        iucnumber: request.smartcardNumber,
        phone,
        ref: request.reference,
        reference: request.reference,
      },
      request.reference
    );
  }

  async queryStatus(reference: string): Promise<ProviderStatusResult> {
    // The only observed status/history endpoint returned account-wide records,
    // which is not an acceptable reconciliation contract and could expose third
    // party data. Fail closed rather than guessing a per-reference query.
    return {
      outcome: 'UNCERTAIN',
      providerReference: reference,
      providerStatus: 'STATUS_CONTRACT_NOT_CERTIFIED',
      message: 'Status reconciliation is not certified. Funds remain reserved for manual review.',
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const snapshot = await this.loadUserSnapshot(true);
      if (snapshot.balanceMinor === null) {
        return { healthy: false, message: 'MaskawaSub did not return an account balance.' };
      }
      const certified = [...parseMaskawaCertifiedServices(env.MASKAWASUB_CERTIFIED_SERVICES)];
      const liveStatus = env.MASKAWASUB_LIVE_PURCHASES
        ? certified.length > 0
          ? `enabled for ${certified.join(', ')}`
          : 'enabled, but no services are certified'
        : 'disabled (contract not certified)';
      return {
        healthy: true,
        message: `MaskawaSub reachable. Provider wallet balance: ${formatNaira(snapshot.balanceMinor)}. Live purchases ${liveStatus}.`,
      };
    } catch (error) {
      return { healthy: false, message: error instanceof Error ? error.message : 'MaskawaSub is unreachable.' };
    }
  }
}
