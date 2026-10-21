import { ServicePlan, Provider } from '../models';
import {
  getActiveProviderKeys,
  getConfiguredProviderKeys,
  getServiceProviderKey,
  getVtuProvider,
  getVtuProviderByKey,
  getVtuProviderForService,
} from '../providers';
import { AppError } from '../utils/AppError';
import { getSetting } from './settingsService';
import { logger } from '../config/logger';
import { percentOf } from '../utils/money';
import { ServiceType } from '../config/constants';
import { Types } from 'mongoose';
import {
  ProviderCableNetwork,
  ProviderCablePackage,
  ProviderDataPlan,
  ProviderDisco,
  VtuProvider,
} from '../providers/types';

interface NetworkCache {
  value: Array<{ code: string; name: string }>;
  expiresAt: number;
}
let networkCache: NetworkCache | null = null;

export async function getNetworks() {
  if (networkCache && networkCache.expiresAt > Date.now()) return networkCache.value;
  const providerKey = getServiceProviderKey('DATA');
  try {
    const provider = getVtuProviderForService('DATA');
    const networks = await provider.getNetworks();
    if (networks.length) {
      networkCache = { value: networks, expiresAt: Date.now() + 5 * 60 * 1000 };
      return networks;
    }
  } catch (error) {
    logger.warn({ err: error }, 'Could not fetch networks from provider; falling back to enabled data networks');
  }
  const fallback = await ServicePlan.distinct('network', {
    service: 'DATA',
    enabled: true,
    provider: providerKey,
  });
  return fallback.filter(Boolean).map((code: string) => ({ code, name: code }));
}

export type DataPlanCategoryCode = 'STANDARD' | 'CORPORATE' | 'GIFTING' | 'COUPON' | 'SHARE' | 'OTHER';

const DATA_PLAN_CATEGORY_LABELS: Record<DataPlanCategoryCode, string> = {
  STANDARD: 'Standard',
  CORPORATE: 'Corporate',
  GIFTING: 'Gifting',
  COUPON: 'Coupon',
  SHARE: 'Share',
  OTHER: 'Other',
};

/**
 * Customer-facing grouping for the provider's plan families. The provider's
 * "SME" family is deliberately labelled "Standard" so the provider name is
 * never exposed in the storefront.
 */
export function normaliseDataPlanCategory(planType?: string | null): {
  code: DataPlanCategoryCode;
  label: string;
} {
  const key = String(planType ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (key === 'SME' || key === 'SME2' || key === 'STANDARD') {
    return { code: 'STANDARD', label: DATA_PLAN_CATEGORY_LABELS.STANDARD };
  }
  if (key === 'CORPORATE' || key === 'CORPORATE2') {
    return { code: 'CORPORATE', label: DATA_PLAN_CATEGORY_LABELS.CORPORATE };
  }
  if (key === 'GIFTING' || key === 'GIFT') {
    return { code: 'GIFTING', label: DATA_PLAN_CATEGORY_LABELS.GIFTING };
  }
  if (key === 'COUPON' || key === 'PROMO') {
    return { code: 'COUPON', label: DATA_PLAN_CATEGORY_LABELS.COUPON };
  }
  if (key === 'SHARE') {
    return { code: 'SHARE', label: DATA_PLAN_CATEGORY_LABELS.SHARE };
  }
  return { code: 'OTHER', label: DATA_PLAN_CATEGORY_LABELS.OTHER };
}

const LEGACY_PLAN_TYPE_SUFFIX = /\s*(?:\u00B7|\u2022)\s*(SME2?|CORPORATE2?|GIFTING|COUPON|SHARE)\s*$/i;

/** Removes legacy provider-family suffixes such as "- SME" from a name. */
export function cleanDataPlanName(name: string): string {
  return name.replace(LEGACY_PLAN_TYPE_SUFFIX, '').trim() || name;
}

function resolveDataPlanCategory(plan: {
  category?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
}): { code: DataPlanCategoryCode; label: string } {
  if (plan.category) {
    return normaliseDataPlanCategory(plan.category);
  }
  const storedType = plan.metadata?.providerPlanType;
  if (typeof storedType === 'string' && storedType.trim()) {
    return normaliseDataPlanCategory(storedType);
  }
  const legacySuffix = plan.name?.match(LEGACY_PLAN_TYPE_SUFFIX)?.[1];
  return normaliseDataPlanCategory(legacySuffix);
}

export async function listDataPlans(network?: string) {
  // Match the service card: if the routed DATA provider is not certified for
  // live purchases, do not expose a staged catalogue to customers.
  if (!isServicePurchasable('DATA')) return [];
  const limits = await getSetting('limits');
  const filter: Record<string, unknown> = {
    service: 'DATA',
    enabled: true,
    provider: getServiceProviderKey('DATA'),
    // Do not show plans that the purchase service would reject. In particular,
    // cheap bundles below the configured minimum cause a confusing late error.
    sellingPriceMinor: { $gte: limits.dataMinMinor, $lte: limits.dataMaxMinor },
  };
  if (network) filter.network = network.toUpperCase();
  const plans = await ServicePlan.find(filter).sort({ costMinor: 1 }).lean();
  return plans.map((plan) => {
    const category = resolveDataPlanCategory(plan);
    return {
      id: String(plan._id),
      providerPlanId: plan.providerPlanId,
      network: plan.network,
      name: cleanDataPlanName(plan.name),
      dataVolume: plan.dataVolume,
      validity: plan.validity,
      category: category.code,
      categoryLabel: category.label,
      priceMinor: plan.sellingPriceMinor,
      isSandbox: plan.isSandbox,
      available: plan.enabled,
    };
  });
}

export async function listElectricityProviders() {
  // Do not expose a staged catalogue for a service that cannot accept an order
  // yet. Admin catalogue views use listAdminPlans() instead.
  if (!isServicePurchasable('ELECTRICITY')) return [];
  const providers = await ServicePlan.find({
    service: 'ELECTRICITY',
    enabled: true,
    provider: getServiceProviderKey('ELECTRICITY'),
    'metadata.kind': 'DISCO',
  })
    .sort({ name: 1 })
    .lean();
  return providers.map((p) => ({
    code: p.providerPlanId,
    name: p.name,
    isSandbox: p.isSandbox,
  }));
}

export async function listCableProviders() {
  if (!isServicePurchasable('CABLE')) return [];
  const providers = await ServicePlan.find({
    service: 'CABLE',
    enabled: true,
    provider: getServiceProviderKey('CABLE'),
    'metadata.kind': 'CABLE_NETWORK',
  })
    .sort({ name: 1 })
    .lean();
  return providers.map((p) => ({
    code: p.providerPlanId.replace('__NETWORK__:', ''),
    name: p.name,
    isSandbox: p.isSandbox,
  }));
}

export async function listCablePackages(network: string) {
  if (!isServicePurchasable('CABLE')) return [];
  const packages = await ServicePlan.find({
    service: 'CABLE',
    enabled: true,
    provider: getServiceProviderKey('CABLE'),
    network: network.toUpperCase(),
    'metadata.kind': 'PACKAGE',
  })
    .sort({ costMinor: 1 })
    .lean();
  return packages.map((p) => ({
    id: String(p._id),
    providerPlanId: p.providerPlanId,
    network: p.network,
    name: p.name,
    validity: p.validity,
    priceMinor: p.sellingPriceMinor,
    isSandbox: p.isSandbox,
  }));
}

/**
 * A catalogue can be visible while its provider is not yet certified for live
 * purchases. The storefront must hide such a service rather than accept an
 * order that can only fail after the wallet is touched.
 */
export function isServicePurchasable(service: ServiceType): boolean {
  try {
    getVtuProviderForService(service).assertCanPurchase(service);
    return true;
  } catch {
    return false;
  }
}

export async function listServices() {
  const [networks, plans, discos, cableProviders] = await Promise.all([
    getNetworks(),
    listDataPlans(),
    listElectricityProviders(),
    listCableProviders(),
  ]);
  const pricing = await getSetting('pricing');
  return [
    {
      key: 'AIRTIME',
      name: 'Airtime',
      enabled: isServicePurchasable('AIRTIME') && networks.length > 0,
      description: 'Instant top-up for all major Nigerian networks.',
      networks,
    },
    {
      key: 'DATA',
      name: 'Mobile Data',
      enabled: isServicePurchasable('DATA') && plans.length > 0,
      description: 'Data bundles synced from the VTU provider catalogue.',
      networks: networks.filter((n) => plans.some((p) => p.network === n.code)),
      planCount: plans.length,
    },
    {
      key: 'ELECTRICITY',
      name: 'Electricity',
      enabled: isServicePurchasable('ELECTRICITY') && discos.length > 0,
      description: 'Prepaid and postpaid bill payments with provider-confirmed tokens.',
      providers: discos,
      pricingConfigured: Boolean(pricing),
    },
    {
      key: 'CABLE',
      name: 'Cable TV',
      enabled: isServicePurchasable('CABLE') && cableProviders.length > 0,
      description: 'DStv, GOtv and StarTimes subscriptions.',
      providers: cableProviders,
      pricingConfigured: Boolean(pricing),
    },
  ];
}

export async function getEnabledPlan(service: ServiceType, providerPlanId: string) {
  const plan = await ServicePlan.findOne({
    service,
    providerPlanId,
    provider: getServiceProviderKey(service),
    enabled: true,
  }).lean();
  if (!plan) throw AppError.badRequest('This plan is not available. Refresh the catalogue and try again.', 'INVALID_PLAN');
  return plan;
}

/**
 * Live SME airtime is billed at face value, so a configured customer discount
 * would be funded by the platform. Keep discounts for sandbox/demo mode only.
 */
export function effectiveAirtimeDiscountPercent(isSandbox: boolean, configuredPercent: number): number {
  return isSandbox ? configuredPercent : 0;
}

export async function quoteAirtime(network: string, faceValueMinor: number) {
  const networks = await getNetworks();
  const normalised = network.toUpperCase();
  if (!networks.some((n) => n.code === normalised)) {
    throw AppError.badRequest('Unsupported network', 'INVALID_NETWORK');
  }
  const [limits, discounts] = await Promise.all([getSetting('limits'), getSetting('discounts')]);
  if (!Number.isSafeInteger(faceValueMinor)) {
    throw AppError.badRequest('Amount must be a whole number of kobo', 'INVALID_AMOUNT');
  }
  if (faceValueMinor < limits.airtimeMinMinor || faceValueMinor > limits.airtimeMaxMinor) {
    throw AppError.badRequest(
      `Airtime amount must be between ₦${limits.airtimeMinMinor / 100} and ₦${limits.airtimeMaxMinor / 100}`,
      'AMOUNT_OUT_OF_RANGE'
    );
  }
  const provider = getVtuProviderForService('AIRTIME');
  const configuredPercent = (discounts.airtimePercent as Record<string, number>)[normalised] ?? 0;
  // SME charges airtime at face value; it does not expose a provider discount.
  // Applying a configured discount on a live provider would make the platform
  // fund the difference, so discounts remain a sandbox-only promotion.
  const percent = effectiveAirtimeDiscountPercent(provider.isSandbox, configuredPercent);
  const discountMinor = percentOf(faceValueMinor, percent);
  const feeMinor = percentOf(faceValueMinor - discountMinor, discounts.serviceFeePercent);
  return {
    network: normalised,
    faceValueMinor,
    discountPercent: percent,
    discountMinor,
    feeMinor,
    payableMinor: faceValueMinor - discountMinor + feeMinor,
    isSandbox: provider.isSandbox,
  };
}

function computeSelling(costMinor: number, markupPercent: number): number {
  return Math.max(1, costMinor + percentOf(costMinor, markupPercent));
}

interface ProviderSyncCounts extends Record<string, number> {
  dataPlans: number;
  electricityProviders: number;
  cableNetworks: number;
  cablePackages: number;
}

interface ProviderSyncResult {
  provider: string;
  name: string;
  isSandbox: boolean;
  services: ServiceType[];
  counts: ProviderSyncCounts;
  errors: string[];
}

/**
 * Pulls one provider's catalogue and applies platform markup. Only services
 * routed to that provider are fetched. Existing manual prices are preserved.
 * A failed service is left untouched; a *successful* empty catalogue disables
 * its old products so stale IDs cannot be purchased.
 */
async function syncProviderCatalogue(
  provider: VtuProvider,
  activeServices: ServiceType[],
  pricing: {
    dataMarkupPercent: number;
    cableMarkupPercent: number;
    preserveManualPlanPricing: boolean;
  }
): Promise<ProviderSyncResult> {
  const errors: string[] = [];
  const dataPlans: ProviderDataPlan[] = [];
  const discos: ProviderDisco[] = [];
  let cableProviders: ProviderCableNetwork[] = [];
  const cablePackages: ProviderCablePackage[] = [];
  const syncedServices = new Set<ServiceType>();

  if (activeServices.includes('DATA')) {
    try {
      const networks = await provider.getNetworks();
      if (!networks.length) throw new Error('provider returned no data networks');
      for (const network of networks) {
        dataPlans.push(...(await provider.getDataPlans(network.code)));
      }
      if (!dataPlans.length) throw new Error('provider returned no data plans');
      syncedServices.add('DATA');
    } catch (error) {
      errors.push(`DATA: ${error instanceof Error ? error.message : 'catalogue fetch failed'}`);
    }
  }

  if (activeServices.includes('CABLE')) {
    try {
      cableProviders = await provider.getCableProviders();
      for (const cable of cableProviders) {
        cablePackages.push(...(await provider.getCablePackages(cable.code)));
      }
      syncedServices.add('CABLE');
    } catch (error) {
      errors.push(`CABLE: ${error instanceof Error ? error.message : 'catalogue fetch failed'}`);
    }
  }

  if (activeServices.includes('ELECTRICITY')) {
    try {
      discos.push(...(await provider.getElectricityProviders()));
      syncedServices.add('ELECTRICITY');
    } catch (error) {
      errors.push(`ELECTRICITY: ${error instanceof Error ? error.message : 'catalogue fetch failed'}`);
    }
  }

  const existing = await ServicePlan.find({ provider: provider.key }).lean();
  const existingMap = new Map(existing.map((p) => [`${p.service}:${p.providerPlanId}`, p]));
  const seenByService = new Map<ServiceType, Set<string>>();
  const now = new Date();
  const ops: Array<Record<string, unknown>> = [];

  const markSeen = (service: ServiceType, providerPlanId: string) => {
    if (!seenByService.has(service)) seenByService.set(service, new Set());
    seenByService.get(service)!.add(providerPlanId);
  };

  const upsert = (
    service: ServiceType,
    providerPlanId: string,
    name: string,
    fields: Record<string, unknown>,
    markupPercent: number,
    costMinor: number,
    network?: string
  ) => {
    markSeen(service, providerPlanId);
    const current = existingMap.get(`${service}:${providerPlanId}`);
    const currentMeta = (current?.metadata ?? {}) as Record<string, unknown>;
    const manual = pricing.preserveManualPlanPricing && Boolean(currentMeta.manualPricing);
    const adminDisabled = Boolean(currentMeta.adminDisabled);
    const selling = manual ? current!.sellingPriceMinor : computeSelling(costMinor, markupPercent);
    ops.push({
      updateOne: {
        filter: { provider: provider.key, service, providerPlanId },
        update: {
          $set: {
            name,
            network: network ?? null,
            costMinor,
            sellingPriceMinor: selling,
            isSandbox: provider.isSandbox,
            syncedAt: now,
            ...(adminDisabled ? {} : { enabled: true }),
            'metadata.stale': false,
            ...fields,
          },
          $setOnInsert: {
            provider: provider.key,
            service,
            providerPlanId,
            'metadata.manualPricing': false,
            'metadata.adminDisabled': false,
          },
        },
        upsert: true,
      },
    });
  };

  for (const plan of dataPlans) {
    const category = normaliseDataPlanCategory(plan.planType);
    upsert(
      'DATA',
      plan.providerPlanId,
      plan.name,
      {
        dataVolume: plan.dataVolume,
        validity: plan.validity,
        category: category.code,
        'metadata.kind': 'PLAN',
        'metadata.providerPlanType': plan.planType ?? null,
      },
      pricing.dataMarkupPercent,
      plan.costMinor,
      plan.network
    );
  }
  for (const disco of discos) {
    upsert(
      'ELECTRICITY',
      disco.code,
      disco.name,
      { 'metadata.kind': 'DISCO', 'metadata.providerNetworkId': disco.providerId ?? null },
      0,
      0,
      disco.code
    );
  }
  for (const cable of cableProviders) {
    upsert(
      'CABLE',
      `__NETWORK__:${cable.code}`,
      cable.name,
      {
        'metadata.kind': 'CABLE_NETWORK',
        validity: null,
        'metadata.providerNetworkId': cable.providerNetworkId ?? null,
      },
      0,
      0,
      cable.code.toUpperCase()
    );
  }
  for (const pkg of cablePackages) {
    upsert(
      'CABLE',
      pkg.providerPlanId,
      pkg.name,
      {
        validity: pkg.validity,
        'metadata.kind': 'PACKAGE',
        'metadata.providerNetworkId': pkg.providerNetworkId ?? null,
      },
      pricing.cableMarkupPercent,
      pkg.costMinor,
      pkg.network.toUpperCase()
    );
  }

  if (ops.length) await ServicePlan.bulkWrite(ops as never[], { ordered: false });

  // Only products returned by a successful service fetch remain enabled.
  for (const service of syncedServices) {
    const seen = seenByService.get(service) ?? new Set<string>();
    const staleObjectIds = existing
      .filter((plan) => plan.service === service && !seen.has(plan.providerPlanId))
      .map((plan) => plan._id);
    if (staleObjectIds.length) {
      await ServicePlan.updateMany(
        { _id: { $in: staleObjectIds }, enabled: true },
        { $set: { enabled: false, 'metadata.stale': true } }
      );
    }
  }

  const syncedControls = syncedServices.size > 0;
  await Provider.findOneAndUpdate(
    { key: provider.key },
    {
      $set: {
        name: provider.name,
        kind: 'VTU',
        adapter: provider.key,
        enabled: true,
        isSandbox: provider.isSandbox,
        health: errors.length ? 'DEGRADED' : syncedControls ? 'HEALTHY' : 'DOWN',
        lastCheckedAt: new Date(),
        lastError: errors.length ? errors.join('; ').slice(0, 500) : null,
      },
      $setOnInsert: { errorCount: 0 },
    },
    { upsert: true }
  );

  return {
    provider: provider.key,
    name: provider.name,
    isSandbox: provider.isSandbox,
    services: [...syncedServices],
    counts: {
      dataPlans: dataPlans.length,
      electricityProviders: discos.length,
      cableNetworks: cableProviders.length,
      cablePackages: cablePackages.length,
    },
    errors,
  };
}

export async function syncCatalogue(actorId?: string) {
  const pricing = await getSetting('pricing');
  const keys = getConfiguredProviderKeys();
  if (!keys.length) throw AppError.serviceUnavailable('No VTU providers are configured.', 'VTU_NOT_CONFIGURED');

  const results: ProviderSyncResult[] = [];
  for (const key of keys) {
    let provider: VtuProvider;
    try {
      provider = getVtuProviderByKey(key);
    } catch (error) {
      results.push({
        provider: key,
        name: key,
        isSandbox: false,
        services: [],
        counts: { dataPlans: 0, electricityProviders: 0, cableNetworks: 0, cablePackages: 0 },
        errors: [error instanceof Error ? error.message : 'provider could not be created'],
      });
      continue;
    }

    const activeServices = (['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE'] as ServiceType[]).filter(
      (service) => getServiceProviderKey(service) === provider.key
    );
    if (!activeServices.length) {
      results.push({
        provider: provider.key,
        name: provider.name,
        isSandbox: provider.isSandbox,
        services: [],
        counts: { dataPlans: 0, electricityProviders: 0, cableNetworks: 0, cablePackages: 0 },
        errors: [],
      });
      continue;
    }

    try {
      results.push(await syncProviderCatalogue(provider, activeServices, pricing));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'catalogue sync failed';
      results.push({
        provider: provider.key,
        name: provider.name,
        isSandbox: provider.isSandbox,
        services: [],
        counts: { dataPlans: 0, electricityProviders: 0, cableNetworks: 0, cablePackages: 0 },
        errors: [message],
      });
      await Provider.findOneAndUpdate(
        { key: provider.key },
        {
          $set: {
            name: provider.name,
            kind: 'VTU',
            adapter: provider.key,
            isSandbox: provider.isSandbox,
            health: 'DOWN',
            lastCheckedAt: new Date(),
            lastError: message.slice(0, 500),
          },
          $setOnInsert: { errorCount: 0 },
        },
        { upsert: true }
      );
    }
  }

  // A provider switch must not leave the previous provider's plans purchasable.
  for (const service of ['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE'] as ServiceType[]) {
    await ServicePlan.updateMany(
      { service, provider: { $ne: getServiceProviderKey(service) }, enabled: true },
      { $set: { enabled: false, 'metadata.stale': true } }
    );
  }

  const successful = results.filter((result) => result.services.length > 0);
  if (!successful.length) {
    throw AppError.serviceUnavailable(
      'No VTU provider catalogue could be synchronized. Existing catalogue was left unchanged.',
      'CATALOGUE_SYNC_FAILED'
    );
  }

  const primary = getVtuProvider();
  const counts = results.reduce<ProviderSyncCounts>(
    (total, result) => ({
      dataPlans: total.dataPlans + result.counts.dataPlans,
      electricityProviders: total.electricityProviders + result.counts.electricityProviders,
      cableNetworks: total.cableNetworks + result.counts.cableNetworks,
      cablePackages: total.cablePackages + result.counts.cablePackages,
    }),
    { dataPlans: 0, electricityProviders: 0, cableNetworks: 0, cablePackages: 0 }
  );

  logger.info(
    { actorId, providers: results.map((r) => r.provider), counts, errors: results.flatMap((r) => r.errors) },
    'VTU catalogue synchronized'
  );

  return {
    provider: primary.key,
    isSandbox: primary.isSandbox,
    counts,
    providers: results,
    syncedAt: new Date(),
  };
}

export async function listAdminPlans(options: {
  service?: string;
  network?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const filter: Record<string, unknown> = {
    provider: { $in: getActiveProviderKeys() },
    'metadata.kind': { $in: ['PLAN', 'PACKAGE', 'DISCO', 'CABLE_NETWORK'] },
  };
  if (options.service) filter.service = options.service;
  if (options.network) filter.network = options.network.toUpperCase();
  if (options.search) filter.name = { $regex: options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [plans, total] = await Promise.all([
    ServicePlan.find(filter)
      .sort({ service: 1, costMinor: 1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .lean(),
    ServicePlan.countDocuments(filter),
  ]);
  return {
    plans: plans.map((plan) =>
      plan.service === 'DATA'
        ? { ...plan, categoryLabel: resolveDataPlanCategory(plan).label }
        : plan
    ),
    total,
  };
}

export async function updatePlan(
  planId: string,
  updates: { enabled?: boolean; sellingPriceMinor?: number; name?: string }
) {
  if (!Types.ObjectId.isValid(planId)) throw AppError.badRequest('Invalid plan id', 'INVALID_ID');
  const plan = await ServicePlan.findById(planId);
  if (!plan) throw AppError.notFound('Plan not found');
  if (plan.provider !== getServiceProviderKey(plan.service)) {
    throw AppError.badRequest('This plan belongs to an inactive provider and cannot be edited.', 'INACTIVE_PROVIDER_PLAN');
  }
  if (updates.enabled !== undefined) {
    plan.enabled = updates.enabled;
    plan.metadata = { ...(plan.metadata ?? {}), adminDisabled: !updates.enabled };
  }
  if (updates.name) plan.name = updates.name;
  if (updates.sellingPriceMinor !== undefined) {
    if (!Number.isSafeInteger(updates.sellingPriceMinor) || updates.sellingPriceMinor < plan.costMinor) {
      throw AppError.badRequest('Selling price cannot be below provider cost', 'INVALID_PRICE');
    }
    plan.sellingPriceMinor = updates.sellingPriceMinor;
    plan.metadata = { ...(plan.metadata ?? {}), manualPricing: true };
  }
  plan.markModified('metadata');
  await plan.save();
  return plan.toObject();
}
