import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatNaira,
  formatNairaCompact,
  formatPhone,
  maskPhone,
  parseNairaToMinor,
  SERVICE_LABELS,
  STATUS_LABELS,
} from './format';

describe('money formatting', () => {
  it('formats integer kobo as Naira without unnecessary decimals', () => {
    expect(formatNaira(0)).toMatch(/₦0/);
    expect(formatNaira(12_300)).toMatch(/₦123/);
    expect(formatNaira(123_400)).toMatch(/₦1,234/);
  });

  it('shows kobo when the amount is not a whole Naira', () => {
    const formatted = formatNaira(123_456);
    expect(formatted).toMatch(/1,234\.56/);
    expect(formatted).not.toBe('—');
  });

  it('supports forced decimals and a positive sign', () => {
    expect(formatNaira(100_000, { decimals: true })).toMatch(/1,000\.00/);
    expect(formatNaira(12_345, { decimals: true, sign: true })).toMatch(/^\+₦123\.45/);
    expect(formatNaira(-12_345)).toMatch(/-₦123\.45/);
  });

  it('returns a dash for missing or non-numeric values', () => {
    expect(formatNaira(null)).toBe('—');
    expect(formatNaira(undefined)).toBe('—');
    expect(formatNaira(Number.NaN)).toBe('—');
  });

  it('formats compact volumes for dashboards', () => {
    expect(formatNairaCompact(50_000)).toBe('₦500');
    expect(formatNairaCompact(1_500_000)).toBe('₦15k');
    expect(formatNairaCompact(250_000_000)).toBe('₦2.5M');
    expect(formatNairaCompact(null)).toBe('—');
  });
});

describe('Naira input parsing', () => {
  it('converts user-entered Naira to integer kobo', () => {
    expect(parseNairaToMinor('100')).toBe(10_000);
    expect(parseNairaToMinor('1,234.50')).toBe(123_450);
    expect(parseNairaToMinor('₦ 50.25')).toBe(5_025);
    expect(parseNairaToMinor('0.01')).toBe(1);
  });

  it('rejects malformed, negative, and over-precise amounts', () => {
    expect(parseNairaToMinor('')).toBeNull();
    expect(parseNairaToMinor('abc')).toBeNull();
    expect(parseNairaToMinor('-10')).toBeNull();
    expect(parseNairaToMinor('1.234')).toBeNull();
    expect(parseNairaToMinor('.')).toBeNull();
  });
});

describe('phone and date helpers', () => {
  it('formats and masks Nigerian phone numbers', () => {
    expect(formatPhone('+2348012345678')).toBe('0801 234 5678');
    expect(maskPhone('+2348012345678')).toBe('0801 ••• 5678');
    expect(maskPhone('08012345678')).toBe('0801 ••• 5678');
    expect(maskPhone(null)).toBe('—');
  });

  it('formats valid dates and safely handles invalid input', () => {
    expect(formatDate('2026-10-20T12:00:00.000Z')).toMatch(/20 Oct 2026/);
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
});

describe('label maps', () => {
  it('exposes human-readable service and status labels', () => {
    expect(SERVICE_LABELS.ELECTRICITY).toBe('Electricity');
    expect(STATUS_LABELS.REQUIRES_REVIEW).toBe('In review');
    expect(STATUS_LABELS.REFUNDED).toBe('Refunded');
  });
});
