import { randomBytes } from 'crypto';

const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomString(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
  }
  return out;
}

export function generateReference(prefix: string): string {
  return `${prefix}_${Date.now().toString(36).toUpperCase()}_${randomString(8)}`;
}

export function generateProviderReference(prefix = 'QT'): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${randomString(6)}`;
}

export function generateReferralCode(name: string): string {
  const base = name.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase() || 'QUIK';
  return `${base}${randomString(5)}`;
}

export function generateTicketReference(): string {
  return `TKT-${randomString(8)}`;
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}
