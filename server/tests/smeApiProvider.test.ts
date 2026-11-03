import { describe, expect, it } from 'vitest';
import { parseSmeBalance } from '../src/providers/smeApiProvider';

describe('parseSmeBalance', () => {
  it.each([
    [2500, 2500],
    ['2500', 2500],
    ['2,500.75', 2500.75],
    ['₦2,500.75', 2500.75],
    ['NGN 2,500.75', 2500.75],
    ['  ₦ 0.50  ', 0.5],
  ])('normalizes %j', (input, expected) => {
    expect(parseSmeBalance(input)).toBe(expected);
  });

  it.each([undefined, null, '', '₦', '2,500.7.5', 'balance unavailable', Infinity])(
    'rejects malformed value %j',
    (input) => {
      expect(parseSmeBalance(input)).toBeNull();
    }
  );
});
