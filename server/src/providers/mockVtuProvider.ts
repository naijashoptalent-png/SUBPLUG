import { randomBytes } from 'crypto';
import { logger } from '../config/logger';
import {
  MeterValidation,
  ProviderCableNetwork,
  ProviderCablePackage,
  ProviderDataPlan,
  ProviderDisco,
  ProviderNetwork,
  ProviderPurchaseRequest,
  ProviderPurchaseResult,
  ProviderStatusResult,
  SmartcardValidation,
  VtuProvider,
} from './types';

/**
 * SANDBOX ADAPTER. It never contacts a real VTU provider and must never be
 * presented to users as a real purchase. Every response is labelled
 * `isSandbox`/`sandbox: true`; electricity tokens are prefixed SANDBOX-.
 *
 * Deterministic outcome rules (documented for QA):
 *  - phone ending 0000       -> definitive FAILED
 *  - phone ending 1111       -> PENDING
 *  - phone ending 2222       -> UNCERTAIN (timeout simulation)
 *  - otherwise               -> SUCCESS
 */
const NETWORKS: ProviderNetwork[] = [
  { code: 'MTN', name: 'MTN' },
  { code: 'AIRTEL', name: 'Airtel' },
  { code: 'GLO', name: 'Glo' },
  { code: '9MOBILE', name: '9mobile' },
];

const DATA_PLANS: ProviderDataPlan[] = [
  { providerPlanId: 'MTN-500MB-7D', network: 'MTN', name: '500MB Daily Plan', dataVolume: '500MB', validity: '7 days', costMinor: 12000 },
  { providerPlanId: 'MTN-1GB-30D', network: 'MTN', name: '1GB Monthly Plan', dataVolume: '1GB', validity: '30 days', costMinor: 27000 },
  { providerPlanId: 'MTN-2GB-30D', network: 'MTN', name: '2GB Monthly Plan', dataVolume: '2GB', validity: '30 days', costMinor: 50000 },
  { providerPlanId: 'MTN-5GB-30D', network: 'MTN', name: '5GB Monthly Plan', dataVolume: '5GB', validity: '30 days', costMinor: 115000 },
  { providerPlanId: 'MTN-10GB-30D', network: 'MTN', name: '10GB Monthly Plan', dataVolume: '10GB', validity: '30 days', costMinor: 220000 },
  { providerPlanId: 'AIRTEL-500MB-7D', network: 'AIRTEL', name: '500MB Daily Plan', dataVolume: '500MB', validity: '7 days', costMinor: 12500 },
  { providerPlanId: 'AIRTEL-1.5GB-30D', network: 'AIRTEL', name: '1.5GB Monthly Plan', dataVolume: '1.5GB', validity: '30 days', costMinor: 32000 },
  { providerPlanId: 'AIRTEL-3GB-30D', network: 'AIRTEL', name: '3GB Monthly Plan', dataVolume: '3GB', validity: '30 days', costMinor: 59000 },
  { providerPlanId: 'AIRTEL-6GB-30D', network: 'AIRTEL', name: '6GB Monthly Plan', dataVolume: '6GB', validity: '30 days', costMinor: 105000 },
  { providerPlanId: 'GLO-1GB-30D', network: 'GLO', name: '1GB Monthly Plan', dataVolume: '1GB', validity: '30 days', costMinor: 24000 },
  { providerPlanId: 'GLO-3GB-30D', network: 'GLO', name: '3GB Monthly Plan', dataVolume: '3GB', validity: '30 days', costMinor: 55000 },
  { providerPlanId: 'GLO-7.5GB-30D', network: 'GLO', name: '7.5GB Monthly Plan', dataVolume: '7.5GB', validity: '30 days', costMinor: 120000 },
  { providerPlanId: '9MOBILE-1GB-30D', network: '9MOBILE', name: '1GB Monthly Plan', dataVolume: '1GB', validity: '30 days', costMinor: 25000 },
  { providerPlanId: '9MOBILE-2GB-30D', network: '9MOBILE', name: '2GB Monthly Plan', dataVolume: '2GB', validity: '30 days', costMinor: 45000 },
  { providerPlanId: '9MOBILE-5GB-30D', network: '9MOBILE', name: '5GB Monthly Plan', dataVolume: '5GB', validity: '30 days', costMinor: 100000 },
];

const DISCOS: ProviderDisco[] = [
  { code: 'IKEDC', name: 'Ikeja Electric (IKEDC)' },
  { code: 'EKEDC', name: 'Eko Electricity (EKEDC)' },
  { code: 'AEDC', name: 'Abuja Electric (AEDC)' },
  { code: 'PHED', name: 'Port Harcourt Electric (PHED)' },
  { code: 'IBEDC', name: 'Ibadan Electric (IBEDC)' },
  { code: 'KEDCO', name: 'Kano Electric (KEDCO)' },
  { code: 'KAEDCO', name: 'Kaduna Electric (KAEDCO)' },
  { code: 'JED', name: 'Jos Electric (JED)' },
  { code: 'BEDC', name: 'Benin Electric (BEDC)' },
  { code: 'EEDC', name: 'Enugu Electric (EEDC)' },
];

const CABLE: ProviderCableNetwork[] = [
  { code: 'DSTV', name: 'DStv' },
  { code: 'GOTV', name: 'GOtv' },
  { code: 'STARTIMES', name: 'StarTimes' },
];

const CABLE_PACKAGES: ProviderCablePackage[] = [
  { providerPlanId: 'DSTV-PADI', network: 'DSTV', name: 'DStv Padi', validity: '1 month', costMinor: 440000 },
  { providerPlanId: 'DSTV-YANGA', network: 'DSTV', name: 'DStv Yanga', validity: '1 month', costMinor: 600000 },
  { providerPlanId: 'DSTV-CONFAM', network: 'DSTV', name: 'DStv Confam', validity: '1 month', costMinor: 1100000 },
  { providerPlanId: 'DSTV-COMPACT', network: 'DSTV', name: 'DStv Compact', validity: '1 month', costMinor: 1900000 },
  { providerPlanId: 'GOTV-JINJA', network: 'GOTV', name: 'GOtv Jinja', validity: '1 month', costMinor: 390000 },
  { providerPlanId: 'GOTV-JOLLI', network: 'GOTV', name: 'GOtv Jolli', validity: '1 month', costMinor: 580000 },
  { providerPlanId: 'GOTV-MAX', network: 'GOTV', name: 'GOtv Max', validity: '1 month', costMinor: 850000 },
  { providerPlanId: 'STARTIMES-NOVA', network: 'STARTIMES', name: 'StarTimes Nova', validity: '1 month', costMinor: 290000 },
  { providerPlanId: 'STARTIMES-BASIC', network: 'STARTIMES', name: 'StarTimes Basic', validity: '1 month', costMinor: 450000 },
  { providerPlanId: 'STARTIMES-SMART', network: 'STARTIMES', name: 'StarTimes Smart', validity: '1 month', costMinor: 650000 },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockVtuProvider implements VtuProvider {
  readonly key = 'mock';
  readonly name = 'Sandbox VTU Adapter';
  readonly isSandbox = true;

  private readonly results = new Map<string, ProviderStatusResult>();

  private log(action: string, reference?: string, payload?: unknown) {
    logger.info({ adapter: 'mock-vtu', action, reference, payload }, 'SANDBOX provider call — no real service delivered');
  }

  async getNetworks(): Promise<ProviderNetwork[]> {
    await delay(80);
    return NETWORKS;
  }

  async getDataPlans(network?: string): Promise<ProviderDataPlan[]> {
    await delay(120);
    return network ? DATA_PLANS.filter((p) => p.network === network.toUpperCase()) : DATA_PLANS;
  }

  async getElectricityProviders(): Promise<ProviderDisco[]> {
    await delay(80);
    return DISCOS;
  }

  async getCableProviders(): Promise<ProviderCableNetwork[]> {
    await delay(80);
    return CABLE;
  }

  async getCablePackages(network: string): Promise<ProviderCablePackage[]> {
    await delay(100);
    return CABLE_PACKAGES.filter((p) => p.network === network.toUpperCase());
  }

  async validateMeter(input: {
    disco: string;
    meterNumber: string;
    meterType: 'PREPAID' | 'POSTPAID';
  }): Promise<MeterValidation> {
    await delay(500);
    this.log('validate-meter', undefined, { disco: input.disco, meter: input.meterNumber });
    if (!DISCOS.some((d) => d.code === input.disco)) {
      return { valid: false, isSandbox: true, message: 'Unknown distribution company in sandbox catalogue' };
    }
    if (!/^\d{10,13}$/.test(input.meterNumber)) {
      return { valid: false, isSandbox: true, message: 'Sandbox meter numbers must be 10–13 digits' };
    }
    return {
      valid: true,
      customerName: 'SANDBOX CUSTOMER (DEMO DATA)',
      customerAddress: 'Demo address — not a real utility customer',
      meterType: input.meterType,
      isSandbox: true,
      message: 'Sandbox validation only — no utility was contacted.',
    };
  }

  async validateSmartcard(input: { provider: string; smartcardNumber: string }): Promise<SmartcardValidation> {
    await delay(450);
    this.log('validate-smartcard', undefined, { provider: input.provider, smartcard: input.smartcardNumber });
    if (!/^\d{8,12}$/.test(input.smartcardNumber)) {
      return { valid: false, isSandbox: true, message: 'Sandbox smartcard numbers must be 8–12 digits' };
    }
    return {
      valid: true,
      customerName: 'SANDBOX SUBSCRIBER (DEMO DATA)',
      isSandbox: true,
      message: 'Sandbox validation only — no cable provider was contacted.',
    };
  }

  async purchase(request: ProviderPurchaseRequest): Promise<ProviderPurchaseResult> {
    await delay(600 + Math.floor(Math.random() * 600));
    this.log('purchase', request.reference, {
      service: request.service,
      network: request.network,
      amountMinor: request.amountMinor,
      planCode: request.planCode,
    });

    const phone = request.phone ?? '';
    let outcome: ProviderStatusResult['outcome'] = 'SUCCESS';
    if (phone.endsWith('0000')) outcome = 'FAILED';
    else if (phone.endsWith('1111')) outcome = 'PENDING';
    else if (phone.endsWith('2222')) outcome = 'UNCERTAIN';

    const providerReference = `MOCK-${randomBytes(5).toString('hex').toUpperCase()}`;
    const result: ProviderStatusResult = {
      outcome,
      providerReference,
      providerStatus: outcome,
      message:
        outcome === 'FAILED'
          ? 'Sandbox deterministic failure (recipient ends in 0000)'
          : outcome === 'PENDING'
            ? 'Sandbox pending result (recipient ends in 1111)'
            : outcome === 'UNCERTAIN'
              ? 'Sandbox simulated timeout (recipient ends in 2222)'
              : 'Sandbox purchase completed. No real service was delivered.',
    };

    if (outcome === 'SUCCESS') {
      if (request.service === 'ELECTRICITY') {
        result.token = `SANDBOX-${randomBytes(8).toString('hex').toUpperCase()}`;
        result.units = '0.0';
      }
      if (request.service === 'ELECTRICITY' || request.service === 'CABLE') {
        result.customerName = request.meterNumber
          ? 'SANDBOX CUSTOMER (DEMO DATA)'
          : 'SANDBOX SUBSCRIBER (DEMO DATA)';
      }
    }

    this.results.set(request.reference, result);
    return { ...result, raw: { sandbox: true } } as ProviderPurchaseResult;
  }

  async queryStatus(reference: string): Promise<ProviderStatusResult> {
    await delay(150);
    const known = this.results.get(reference);
    if (known) return known;
    return {
      outcome: 'PENDING',
      providerStatus: 'UNKNOWN_IN_SANDBOX',
      message: 'No sandbox record for this reference (process may have restarted).',
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true, message: 'Sandbox adapter ready (no external calls)' };
  }
}
