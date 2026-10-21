import { describe, expect, it } from 'vitest';
import { sanitiseCustomerCopy } from '../src/utils/customerCopy';

describe('customer copy sanitisation', () => {
  it('removes provider names without changing the rest of the message', () => {
    expect(sanitiseCustomerCopy('MaskawaSub returned no purchase response')).toBe(
      'provider returned no purchase response'
    );
    expect(sanitiseCustomerCopy('SME API could not be reached')).toBe(
      'provider could not be reached'
    );
    expect(sanitiseCustomerCopy('The provider is unavailable')).toBe('The provider is unavailable');
    expect(sanitiseCustomerCopy('')).toBeNull();
    expect(sanitiseCustomerCopy(null)).toBeNull();
  });
});
