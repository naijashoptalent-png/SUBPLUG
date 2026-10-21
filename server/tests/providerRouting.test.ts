import { afterEach, describe, expect, it } from 'vitest';
import {
  clearProviderRoutingForTests,
  isSwitchableService,
  normaliseSwitchableProvider,
  resolveServiceProviderKey,
  setProviderRouting,
} from '../src/providers/routing';

afterEach(() => {
  clearProviderRoutingForTests();
});

describe('provider routing', () => {
  it('keeps cable and electricity fixed to MaskawaSub', () => {
    expect(resolveServiceProviderKey('CABLE', {})).toBe('maskawasub');
    expect(resolveServiceProviderKey('ELECTRICITY', {})).toBe('maskawasub');
  });

  it('switches only airtime and data at runtime', () => {
    setProviderRouting({ AIRTIME: 'maskawasub', DATA: 'sme' });

    expect(resolveServiceProviderKey('AIRTIME')).toBe('maskawasub');
    expect(resolveServiceProviderKey('DATA')).toBe('sme');
    expect(resolveServiceProviderKey('CABLE')).toBe('maskawasub');
    expect(resolveServiceProviderKey('ELECTRICITY')).toBe('maskawasub');

    expect(isSwitchableService('AIRTIME')).toBe(true);
    expect(isSwitchableService('DATA')).toBe(true);
    expect(isSwitchableService('CABLE')).toBe(false);
    expect(isSwitchableService('ELECTRICITY')).toBe(false);
  });

  it('ignores unsupported provider values instead of routing to an unknown adapter', () => {
    expect(normaliseSwitchableProvider('sme')).toBe('sme');
    expect(normaliseSwitchableProvider('maskawasub')).toBe('maskawasub');
    expect(normaliseSwitchableProvider('all')).toBeUndefined();
    expect(normaliseSwitchableProvider('')).toBeUndefined();
  });
});
