import { ServiceType } from '../config/constants';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { getSetting } from '../services/settingsService';

export type SwitchableProvider = 'sme' | 'maskawasub';
export type SwitchableService = 'AIRTIME' | 'DATA';

type RoutingOverrides = Partial<Record<SwitchableService, SwitchableProvider>>;

let overrides: RoutingOverrides = {};
let lastLocalMutationAt = 0;

export function isSwitchableService(service: ServiceType): service is SwitchableService {
  return service === 'AIRTIME' || service === 'DATA';
}

export function normaliseSwitchableProvider(value: unknown): SwitchableProvider | undefined {
  return value === 'sme' || value === 'maskawasub' ? value : undefined;
}

/**
 * Resolves the provider for a service.
 *
 * Airtime and data can be switched between the two live adapters at runtime.
 * Every other service is intentionally fixed to MaskawaSub: there is no
 * SME fallback for cable, electricity, or any future non-airtime/data service.
 */
export function resolveServiceProviderKey(
  service: ServiceType,
  currentOverrides: RoutingOverrides = overrides
): string {
  if (!isSwitchableService(service)) return 'maskawasub';

  const override = currentOverrides[service];
  if (override) return override;

  const envOverride = service === 'AIRTIME' ? env.VTU_AIRTIME_PROVIDER : env.VTU_DATA_PROVIDER;
  return envOverride || env.VTU_PROVIDER;
}

export function getRoutingOverrides(): RoutingOverrides {
  return { ...overrides };
}

function applyProviderRouting(next: Partial<Record<SwitchableService, SwitchableProvider | undefined>>): void {
  overrides = {};
  if (next.AIRTIME) overrides.AIRTIME = next.AIRTIME;
  if (next.DATA) overrides.DATA = next.DATA;
}

export function setProviderRouting(next: Partial<Record<SwitchableService, SwitchableProvider | undefined>>): void {
  applyProviderRouting(next);
  lastLocalMutationAt = Date.now();
}

export async function loadProviderRouting(): Promise<void> {
  const loadStartedAt = Date.now();
  try {
    const setting = await getSetting('providerRouting');
    // A background refresh that began before an admin switch must not restore
    // the old route after the switch has already been acknowledged.
    if (lastLocalMutationAt > loadStartedAt) return;
    applyProviderRouting({
      AIRTIME: normaliseSwitchableProvider(setting.airtimeProvider),
      DATA: normaliseSwitchableProvider(setting.dataProvider),
    });
  } catch (error) {
    logger.warn({ err: error }, 'Could not load provider routing; falling back to environment routes');
  }
}

export function clearProviderRoutingForTests(): void {
  overrides = {};
  lastLocalMutationAt = 0;
}
