import { ServicePlan, Provider } from '../models';
import { getVtuProvider } from '../providers';
import { AppError } from '../utils/AppError';
import { getSetting } from './settingsService';
import { logger } from '../config/logger';
import { percentOf } from '../utils/money';
import { ServiceType } from '../config/constants';
import { Types } from 'mongoose';
import { ProviderCablePackage, ProviderDataPlan } from '../providers/types';

interface NetworkCache {
  value: Array<{ code: string; name: string }>;
  expiresAt: number;
}
let networkCache: NetworkCache | null = null;

export async function getNetworks() {
  if (networkCache && networkCache.expiresAt > Date.now()) return networkCache.value;
  try {
    const provider = getVtuProvider();
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
    provider: getVtuProvider().key,
  });
  return fallback.filter(Boolean).map((code: string) => ({ code, name: code }));
}

export async function listDataPlans(network?: string) {
  const filter: Record<string, unknown> = { service: 'DATA', enabled: true, provider: getVtuProvider().key };
  if (network) filter.network = network.toUpperCase();
  const plans = await ServicePlan.find(filter).sort({ costMinor: 1 }).lean();
  return plans.map((plan) => ({
    id: String(plan._id),
    providerPlanId: plan.providerPlanId,
    network: plan.network,
    name: plan.name,
    dataVolume: plan.dataVolume,
    validity: plan.validity,
    priceMinor: plan.sellingPriceMinor,
    isSandbox: plan.isSandbox,
    available: plan.enabled,
  }));
}

export async function listElectricityProviders() {
  const providers = await ServicePlan.find({
    service: 'ELECTRICITY',
    enabled: true,
    provider: getVtuProvider().key,
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
  const providers = await ServicePlan.find({
    service: 'CABLE',
    enabled: true,
    provider: getVtuProvider().key,
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
  const packages = await ServicePlan.find({
    service: 'CABLE',
    enabled: true,
    provider: getVtuProvider().key,
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

export async function listServices() {
  const [networks, plans, discos, cableProviders] = await Promise.all([
    getNetworks(),
    listDataPlans(),
    listElectricityProviders(),
    listCableProviders(),
  ]);
  const serviceFlags = await getSetting('pricing'); // ensures settings loaded
  return [
    {
      key: 'AIRTIME',
      name: 'Airtime',
      enabled: true,
      description: 'Instant top-up for all major Nigerian networks.',
      networks,
    },
    {
      key: 'DATA',
      name: 'Mobile Data',
      enabled: plans.length > 0,
      description: 'Data bundles synced from the VTU provider catalogue.',
      networks: networks.filter((n) => plans.some((p) => p.network === n.code)),
      planCount: plans.length,
    },
    {
      key: 'ELECTRICITY',
      name: 'Electricity',
      enabled: discos.length > 0,
      description: 'Prepaid and postpaid bill payments with provider-confirmed tokens.',
      providers: discos,
    },
    {
      key: 'CABLE',
      name: 'Cable TV',
      enabled: cableProviders.length > 0,
      description: 'DStv, GOtv and StarTimes subscriptions.',
      providers: cableProviders,
      pricingConfigured: Boolean(serviceFlags),
    },
  ];
}

export async function getEnabledPlan(service: ServiceType, providerPlanId: string) {
  const plan = await ServicePlan.findOne({
    service,
    providerPlanId,
    enabled: true,
  }).lean();
  if (!plan) throw AppError.badRequest('This plan is not available. Refresh the catalogue and try again.', 'INVALID_PLAN');
  return plan;
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
  const percent = (discounts.airtimePercent as Record<string, number>)[normalised] ?? 0;
  const discountMinor = percentOf(faceValueMinor, percent);
  const feeMinor = percentOf(faceValueMinor - discountMinor, discounts.serviceFeePercent);
  return {
    network: normalised,
    faceValueMinor,
    discountPercent: percent,
    discountMinor,
    feeMinor,
    payableMinor: faceValueMinor - discountMinor + feeMinor,
    isSandbox: getVtuProvider().isSandbox,
  };
}

function computeSelling(costMinor: number, markupPercent: number): number {
  return Math.max(1, costMinor + percentOf(costMinor, markupPercent));
}

/**
 * Pulls the authoritative catalogue from the configured provider and applies
 * platform markup. Existing manual prices are preserved when configured.
 * Products missing from a *successful, non-empty* provider response are
 * disabled rather than deleted, so historical receipts remain intact.
 */
export async function syncCatalogue(actorId?: string) {
  const provider = getVtuProvider();
  const [pricing, networks] = await Promise.all([getSetting('pricing'), provider.getNetworks()]);
  if (!networks.length) throw AppError.serviceUnavailable('Provider returned no networks; catalogue not changed', 'EMPTY_CATALOGUE');

  const dataPlans: ProviderDataPlan[] = [];
  for (const network of networks) {
    const plans = await provider.getDataPlans(network.code);
    dataPlans.push(...plans);
  }
  const [discos, cableProviders] = await Promise.all([
    provider.getElectricityProviders(),
    provider.getCableProviders(),
  ]);
  const cablePackages: ProviderCablePackage[] = [];
  for (const cable of cableProviders) {
    const packages = await provider.getCablePackages(cable.code);
    cablePackages.push(...packages);
  }

  const existing = await ServicePlan.find({ provider: provider.key }).lean();
  const existingMap = new Map(existing.map((p) => [`${p.service}:${p.providerPlanId}`, p]));
  const seen = new Set<string>();
  const now = new Date();
  const ops: Array<Record<string, unknown>> = [];

  const upsert = (
    service: ServiceType,
    providerPlanId: string,
    name: string,
    fields: Record<string, unknown>,
    markupPercent: number,
    costMinor: number,
    network?: string
  ) => {
    const key = `${service}:${providerPlanId}`;
    seen.add(key);
    const current = existingMap.get(key);
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
            // Re-enable products that were marked stale by a previous sync, but
            // respect an explicit admin decision to hide a product.
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
    upsert(
      'DATA',
      plan.providerPlanId,
      plan.name,
      { dataVolume: plan.dataVolume, validity: plan.validity, 'metadata.kind': 'PLAN' },
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
      { 'metadata.kind': 'DISCO' },
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
      { 'metadata.kind': 'CABLE_NETWORK', validity: null },
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
      { validity: pkg.validity, 'metadata.kind': 'PACKAGE' },
      pricing.cableMarkupPercent,
      pkg.costMinor,
      pkg.network.toUpperCase()
    );
  }

  if (ops.length) await ServicePlan.bulkWrite(ops as never[], { ordered: false });

  // Disable products that were not returned by this successful sync.
  const returnedIds = [...seen];
  await ServicePlan.updateMany(
    {
      provider: provider.key,
      $or: returnedIds.map((key) => {
        const [service, ...rest] = key.split(':');
        return { service, providerPlanId: rest.join(':') };
      }),
    },
    { $set: { 'metadata.stale': false } }
  );
  if (existing.length > 0) {
    const returnedObjectIds = existing
      .filter((e) => seen.has(`${e.service}:${e.providerPlanId}`))
      .map((e) => e._id);
    await ServicePlan.updateMany(
      { provider: provider.key, _id: { $nin: returnedObjectIds }, enabled: true },
      { $set: { enabled: false, 'metadata.stale': true } }
    );
  }

  await Provider.findOneAndUpdate(
    { key: provider.key },
    {
      $set: {
        name: provider.name,
        kind: 'VTU',
        adapter: provider.key,
        enabled: true,
        isSandbox: provider.isSandbox,
        health: 'HEALTHY',
        lastCheckedAt: new Date(),
        lastError: null,
      },
      $setOnInsert: { errorCount: 0 },
    },
    { upsert: true }
  );

  logger.info(
    { actorId, provider: provider.key, dataPlans: dataPlans.length, discos: discos.length, cablePackages: cablePackages.length },
    'VTU catalogue synchronized'
  );

  return {
    provider: provider.key,
    isSandbox: provider.isSandbox,
    counts: {
      dataPlans: dataPlans.length,
      electricityProviders: discos.length,
      cableNetworks: cableProviders.length,
      cablePackages: cablePackages.length,
    },
    syncedAt: now,
  };
}

export async function listAdminPlans(options: {
  service?: string;
  network?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const filter: Record<string, unknown> = { 'metadata.kind': { $in: ['PLAN', 'PACKAGE', 'DISCO', 'CABLE_NETWORK'] } };
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
  return { plans, total };
}

export async function updatePlan(
  planId: string,
  updates: { enabled?: boolean; sellingPriceMinor?: number; name?: string }
) {
  if (!Types.ObjectId.isValid(planId)) throw AppError.badRequest('Invalid plan id', 'INVALID_ID');
  const plan = await ServicePlan.findById(planId);
  if (!plan) throw AppError.notFound('Plan not found');
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
