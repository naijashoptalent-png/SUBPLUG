import { SERVICE_TYPES, ServiceType } from '../config/constants';
import { env, isProduction } from '../config/env';
import { AppError } from '../utils/AppError';
import { MaskawaSubProvider } from './maskawaSubProvider';
import { MockVtuProvider } from './mockVtuProvider';
import { getRoutingOverrides, resolveServiceProviderKey } from './routing';
import { SmeApiProvider } from './smeApiProvider';
import { VtuProvider } from './types';

export {
  isSwitchableService,
  loadProviderRouting,
  normaliseSwitchableProvider,
  setProviderRouting,
} from './routing';
export type { SwitchableProvider, SwitchableService } from './routing';

const instances = new Map<string, VtuProvider>();
let testProvider: VtuProvider | null = null;

function createProvider(key: string): VtuProvider {
  if (key === 'mock') {
    if (isProduction && !env.ALLOW_SANDBOX_IN_PRODUCTION) {
      throw AppError.serviceUnavailable('Mock VTU provider is disabled in production', 'VTU_MOCK_DISABLED');
    }
    return new MockVtuProvider();
  }
  if (key === 'sme') return new SmeApiProvider();
  if (key === 'maskawasub') return new MaskawaSubProvider();
  throw AppError.serviceUnavailable('The selected VTU provider is not configured.', 'VTU_NOT_CONFIGURED');
}

export function getVtuProviderByKey(key: string): VtuProvider {
  if (testProvider && testProvider.key === key) return testProvider;
  const existing = instances.get(key);
  if (existing) return existing;
  const created = createProvider(key);
  instances.set(key, created);
  return created;
}

/**
 * The default provider. Existing callers that are not service-aware keep this
 * behaviour; service-aware callers must use getVtuProviderForService().
 */
export function getVtuProvider(): VtuProvider {
  if (testProvider) return testProvider;
  return getVtuProviderByKey(env.VTU_PROVIDER);
}

/**
 * Resolves the provider that owns a service. Per-service overrides let the
 * secondary provider take cable/electricity/education while SME remains the
 * primary airtime/data provider. This is selection *before* submission, never
 * an automatic retry after a provider call.
 */
export function getServiceProviderKey(service: ServiceType): string {
  if (testProvider) return testProvider.key;
  return resolveServiceProviderKey(service);
}

export function getVtuProviderForService(service: ServiceType): VtuProvider {
  return getVtuProviderByKey(getServiceProviderKey(service));
}

/**
 * Every provider that is configured for at least one route. Used by catalogue
 * sync and admin health checks. Duplicate keys are removed.
 */
export function getConfiguredProviderKeys(): string[] {
  if (testProvider) return [testProvider.key];
  const keys = [
    env.VTU_PROVIDER,
    env.VTU_BACKUP_PROVIDER,
    env.VTU_AIRTIME_PROVIDER,
    env.VTU_DATA_PROVIDER,
    env.VTU_CABLE_PROVIDER,
    env.VTU_ELECTRICITY_PROVIDER,
    env.VTU_EDUCATION_PROVIDER,
    env.VTU_AIRTIME_TO_CASH_PROVIDER,
    env.VTU_RECHARGE_CARD_PROVIDER,
    ...Object.values(getRoutingOverrides()),
    // Keep both switchable adapters warm when credentials exist. This makes
    // health checks useful before a route change and avoids hiding a provider
    // merely because it is not currently selected.
    env.VTU_API_KEY ? 'sme' : '',
    env.MASKAWASUB_API_KEY ? 'maskawasub' : '',
  ].filter(Boolean);
  return [...new Set(keys)];
}

export function getActiveProviderKeys(): string[] {
  if (testProvider) return [testProvider.key];
  const keys = new Set<string>();
  for (const service of SERVICE_TYPES) {
    keys.add(getServiceProviderKey(service));
  }
  return [...keys];
}

export function setVtuProviderForTests(instance: VtuProvider | null): void {
  testProvider = instance;
  instances.clear();
  if (instance) instances.set(instance.key, instance);
}

export type { VtuProvider } from './types';
