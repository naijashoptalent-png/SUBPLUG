/** Money is always handled as integer minor units (kobo). 1 NGN = 100 kobo. */
export function nairaToMinor(naira: number): number {
  if (!Number.isFinite(naira) || naira < 0) throw new Error('Invalid naira amount');
  return Math.round(naira * 100);
}

export function minorToNaira(minor: number): number {
  return Math.round(minor) / 100;
}

export function formatNaira(minor: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(minorToNaira(minor));
}

export function assertPositiveMinor(amount: number, field = 'amount'): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`${field} must be a positive integer in minor units`);
  }
}

export function percentOf(minor: number, percent: number): number {
  return Math.round((minor * percent) / 100);
}
