const SENSITIVE_KEYS = [
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'secretkey',
  'secret_key',
  'apikey',
  'api_key',
  'authorization',
  'password',
  'passwordhash',
  'card',
  'cvv',
  'pin',
  'otp',
  'totpsecret',
  'smartcard',
  'meter',
  'phone',
  'email',
  'nin',
  'bvn',
];

function isSensitive(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((k) => lower.includes(k));
}

/**
 * Produces a structurally safe copy of a provider payload for storage/logging.
 * Phone numbers and meter numbers are partially masked; secrets are removed.
 */
export function sanitizeProviderPayload(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length > 1000) return `${value.slice(0, 1000)}…`;
    return value.replace(/(\+?234|0)(\d{2})\d{6}(\d{2})/g, (_m, p1, p2, p3) => `${p1}${p2}****${p3}`);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => sanitizeProviderPayload(v, depth + 1));
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitive(key)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = sanitizeProviderPayload(val, depth + 1);
      }
    }
    return output;
  }
  return '[UNSERIALIZABLE]';
}
