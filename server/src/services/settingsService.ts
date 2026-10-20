import { SystemSetting } from '../models';
import { DEFAULT_SETTINGS, SETTING_KEYS } from '../config/constants';
import { logger } from '../config/logger';

type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];
type SettingsShape = typeof DEFAULT_SETTINGS;

const cache = new Map<string, { value: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 15_000;

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsShape[K]> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as SettingsShape[K];
  }
  const doc = await SystemSetting.findOne({ key }).lean();
  const fallback = DEFAULT_SETTINGS[key];
  const value = doc?.value
    ? { ...(fallback as object), ...(doc.value as object) }
    : fallback;
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value as SettingsShape[K];
}

export async function getPublicSettings() {
  const [branding, support, maintenance, referralSettings] = await Promise.all([
    getSetting('branding'),
    getSetting('support'),
    getSetting('maintenance'),
    getSetting('referrals'),
  ]);
  return {
    branding,
    support,
    maintenance: { enabled: maintenance.enabled, message: maintenance.message },
    referralsEnabled: referralSettings.enabled,
  };
}

export async function getAllSettings() {
  const entries = await Promise.all(
    Object.values(SETTING_KEYS).map(async (key) => [key, await getSetting(key as SettingKey)] as const)
  );
  return Object.fromEntries(entries);
}

export async function updateSetting(key: SettingKey, value: Record<string, unknown>, updatedBy?: string) {
  const fallback = DEFAULT_SETTINGS[key] as Record<string, unknown>;
  const merged = { ...fallback, ...value };
  const doc = await SystemSetting.findOneAndUpdate(
    { key },
    { $set: { value: merged, updatedBy: updatedBy ?? null } },
    { upsert: true, new: true }
  );
  cache.delete(key);
  logger.info({ setting: key }, 'System setting updated');
  return doc!.value;
}

export async function isMaintenanceMode(): Promise<boolean> {
  try {
    const maintenance = await getSetting('maintenance');
    return Boolean(maintenance.enabled);
  } catch {
    return false;
  }
}

export function invalidateSettingsCache() {
  cache.clear();
}
