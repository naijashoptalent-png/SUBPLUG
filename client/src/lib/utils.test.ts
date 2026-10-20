import { describe, expect, it } from 'vitest';
import { cn, initials, newIdempotencyKey, percentChange, titleCase, truncateMiddle } from './utils';

describe('idempotency keys', () => {
  it('creates an API-safe key with the requested prefix', () => {
    const key = newIdempotencyKey('purchase');

    expect(key).toMatch(/^purchase_[A-Za-z0-9]+$/);
    expect(key.length).toBeGreaterThanOrEqual(8);
    expect(key.length).toBeLessThanOrEqual(100);
  });

  it('does not repeat keys across calls', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey('fund')));
    expect(keys.size).toBe(50);
  });

  it('supports the default prefix', () => {
    expect(newIdempotencyKey()).toMatch(/^op_/);
  });
});

describe('display helpers', () => {
  it('derives initials from the first two names', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('  chinedu  okafor  ')).toBe('CO');
    expect(initials('Prince')).toBe('P');
    expect(initials('')).toBe('');
  });

  it('title-cases machine values', () => {
    expect(titleCase('REQUIRES_REVIEW')).toBe('Requires Review');
    expect(titleCase('in-progress')).toBe('In Progress');
    expect(titleCase('successful')).toBe('Successful');
  });

  it('truncates long identifiers in the middle', () => {
    expect(truncateMiddle('1234567890', 3, 3)).toBe('123…890');
    expect(truncateMiddle('short', 4, 4)).toBe('short');
  });

  it('calculates percentage change without dividing by zero', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 0)).toBe(100);
  });

  it('merges Tailwind classes with later classes taking precedence', () => {
    expect(cn('px-2 text-sm', 'px-4', false && 'hidden')).toBe('text-sm px-4');
  });
});
