import { describe, expect, it } from 'vitest';
import {
  normaliseMaskawaCableCode,
  normaliseMaskawaOutcome,
  normaliseMaskawaPurchase,
  parseMaskawaCableCatalogue,
  parseMaskawaCertifiedServices,
  parseMaskawaDataPlans,
  parseMaskawaDiscos,
  toMaskawaPhone,
} from '../src/providers/maskawaSubProvider';

describe('MaskawaSub catalogue parsing', () => {
  it('uses provider-owned plan IDs and network IDs, and converts Naira to kobo', () => {
    const plans = parseMaskawaDataPlans({
      MTN_PLAN: {
        ALL: [
          {
            id: 352,
            network: 1,
            plan_type: 'CORPORATE GIFTING 2',
            plan_network: 'MTN',
            month_validate: '30[days] CORPORATE 2',
            plan: '100.0MB',
            plan_amount: '24.0',
          },
        ],
      },
      '9MOBILE_PLAN': {
        ALL: [
          {
            id: 362,
            network: 3,
            plan_type: 'CORPORATE GIFTING',
            plan_network: '9MOBILE',
            month_validate: '30 DAYS (CG)',
            plan: '500.0MB',
            plan_amount: '140.0',
          },
        ],
      },
    });

    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({
      providerPlanId: '352',
      network: 'MTN',
      name: '100.0MB',
      dataVolume: '100.0MB',
      validity: '30[days] CORPORATE 2',
      planType: 'CORPORATE GIFTING 2',
      costMinor: 2_400,
    });
    expect(plans[1]).toMatchObject({ providerPlanId: '362', network: '9MOBILE', costMinor: 14_000 });
  });

  it('drops malformed, implausible and duplicate plan rows instead of inventing prices', () => {
    const plans = parseMaskawaDataPlans({
      MTN_PLAN: {
        ALL: [
          { id: 1, network: 1, plan: '1GB', plan_amount: '550000000' },
          { id: 2, network: 1, plan: '1GB', plan_amount: '0' },
          { id: 3, network: 1, plan: '1GB', plan_amount: '250' },
          { id: 3, network: 1, plan: '1GB', plan_amount: '250' },
          { id: 4, network: 9, plan: '1GB', plan_amount: '250' },
        ],
      },
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ providerPlanId: '3', network: 'MTN', costMinor: 25_000 });
  });

  it('maps cable-network and package IDs from the account snapshot', () => {
    const catalogue = parseMaskawaCableCatalogue({
      cablename: [
        { id: 1, name: 'GOTV' },
        { id: 2, name: 'DSTV' },
        { id: 3, name: 'STARTIME' },
      ],
      GOTVPLAN: [
        { id: 34, cableplan_id: '34', cable: 'GOTV', package: 'GOtv Smallie - Monthly', plan_amount: '1900' },
        { id: 34, cableplan_id: '34', cable: 'GOTV', package: 'GOtv Smallie - Monthly', plan_amount: '1900' },
      ],
      DSTVPLAN: [
        { id: 32, cableplan_id: '32', cable: 'DSTV', package: 'DStv HDPVR Access Service', plan_amount: '5100' },
      ],
      STARTIMEPLAN: [
        { id: 42, cableplan_id: '42', cable: 'STARTIME', package: 'Nova - 200 Naira - 1 Day', plan_amount: '200' },
      ],
    });

    expect(catalogue.providers).toEqual(
      expect.arrayContaining([
        { code: 'GOTV', name: 'GOtv', providerNetworkId: '1' },
        { code: 'DSTV', name: 'DStv', providerNetworkId: '2' },
        { code: 'STARTIMES', name: 'StarTimes', providerNetworkId: '3' },
      ])
    );
    expect(catalogue.packages).toHaveLength(3);
    expect(catalogue.packages[0]).toMatchObject({
      providerPlanId: '34',
      network: 'GOTV',
      providerNetworkId: '1',
      costMinor: 190_000,
    });
    expect(normaliseMaskawaCableCode('STARTIME')).toBe('STARTIMES');
    expect(normaliseMaskawaCableCode('startimes')).toBe('STARTIMES');
  });

  it('only treats explicitly allowlisted services as certified', () => {
    expect([...parseMaskawaCertifiedServices('')]).toEqual([]);
    expect([...parseMaskawaCertifiedServices('all, unknown')]).toEqual([]);
    expect([...parseMaskawaCertifiedServices(' cable, ELECTRICITY ,CABLE')]).toEqual([
      'CABLE',
      'ELECTRICITY',
    ]);
  });

  it('keeps electricity provider IDs and gives stable customer codes', () => {
    const discos = parseMaskawaDiscos({
      disko: [
        { id: 1, name: 'Ikeja Electric' },
        { id: 6, name: 'Port Harcourt Electric' },
        { id: 11, name: 'Yola Electric' },
      ],
    });
    expect(discos).toEqual([
      { code: 'IKEJA', name: 'Ikeja Electric', providerId: '1' },
      { code: 'PH', name: 'Port Harcourt Electric', providerId: '6' },
      { code: 'YOLA', name: 'Yola Electric', providerId: '11' },
    ]);
  });
});

describe('MaskawaSub response normalisation', () => {
  it('does not treat ambiguous or lookup-only responses as success', () => {
    expect(normaliseMaskawaOutcome({ status: 'success', message: 'Airtime delivered' })).toBe('SUCCESS');
    expect(normaliseMaskawaOutcome({ status: 'pending' })).toBe('PENDING');
    expect(normaliseMaskawaOutcome({ status: 'failed', message: 'Insufficient balance' })).toBe('FAILED');
    expect(normaliseMaskawaOutcome({ status: 'success', data: { status: 'failed' } })).toBe('UNCERTAIN');
    expect(normaliseMaskawaOutcome({ message: 'Unknown upstream state' })).toBe('UNCERTAIN');
  });

  it('extracts a defensive provider reference without exposing the raw account body', () => {
    const result = normaliseMaskawaPurchase({
      status: 'success',
      message: 'Airtime sent',
      data: { reference: 'MS-123', token: 'TOKEN-123' },
    });
    expect(result).toMatchObject({
      outcome: 'SUCCESS',
      providerReference: 'MS-123',
      token: 'TOKEN-123',
    });
    expect(JSON.stringify(result.raw)).not.toMatch(/password|pin|email|phone/i);
  });

  it('normalises local Nigerian numbers without accepting non-Nigerian digits', () => {
    expect(toMaskawaPhone('+2347065896598')).toBe('07065896598');
    expect(toMaskawaPhone('2347065896598')).toBe('07065896598');
    expect(toMaskawaPhone('07065896598')).toBe('07065896598');
    expect(() => toMaskawaPhone('12345')).toThrow(/valid Nigerian phone/i);
  });
});
