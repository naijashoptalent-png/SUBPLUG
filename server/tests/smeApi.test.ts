import { describe, expect, it } from 'vitest';
import {
  normaliseSmeOutcome,
  normaliseSmePurchase,
  parseSmeDataPlans,
  toSmePhone,
} from '../src/providers/smeApiProvider';

describe('SME API response normalisation', () => {
  it('converts internal E.164 phone numbers to the provider local format', () => {
    expect(toSmePhone('+2347065896598')).toBe('07065896598');
    expect(toSmePhone('2347065896598')).toBe('07065896598');
    expect(toSmePhone('07065896598')).toBe('07065896598');
    expect(() => toSmePhone('12345')).toThrow(/valid Nigerian phone/i);
  });

  it('parses live data plans and converts Naira prices to integer kobo', () => {
    const plans = parseSmeDataPlans({
      status: 'success',
      data: [
        { id: 1, network_id: 1, network: 'MTN', name: '500MB', type: 'SME', days: '7days', price: 230 },
        { id: 60, network_id: 4, network: 'AIRTEL', name: '75MB', type: 'SME', days: '1day', price: 77.5 },
      ],
    });

    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({
      providerPlanId: '1',
      network: 'MTN',
      name: '500MB',
      dataVolume: '500MB',
      validity: '7days',
      planType: 'SME',
      costMinor: 23_000,
    });
    expect(plans[1]).toMatchObject({
      providerPlanId: '60',
      network: 'AIRTEL',
      planType: 'SME',
      costMinor: 7_750,
    });
  });

  it('fails closed when the data-plan endpoint does not return a success payload', () => {
    expect(() => parseSmeDataPlans({ status: 'fail', msg: 'Invalid API key' })).toThrow(/Invalid API key/);
    expect(() => parseSmeDataPlans({ status: 'success', data: null })).toThrow(/invalid data-plan response/i);
  });

  it('maps provider statuses without treating ambiguous responses as success', () => {
    expect(normaliseSmeOutcome({ status: 'success', message: 'Airtime delivered' })).toBe('SUCCESS');
    expect(normaliseSmeOutcome({ status: 'success', Status: 'pending' })).toBe('PENDING');
    expect(normaliseSmeOutcome({ status: 'fail', msg: 'Insufficient balance' })).toBe('FAILED');
    expect(normaliseSmeOutcome({ status: 'success', data: { status: 'failed' } })).toBe('UNCERTAIN');
    expect(normaliseSmeOutcome({ message: 'Unknown upstream state' })).toBe('UNCERTAIN');
  });

  it('extracts electricity tokens, references and customer names from documented response variants', () => {
    const result = normaliseSmePurchase(
      {
        status: 'success',
        Status: 'successful',
        plan_description: 'Token: 8378-9287-1122-3344',
        transaction_ref: 'SME-REF-123',
        Customer_Name: 'MUSA YUSUF',
        amount_paid: 1000,
      },
      'TXN-LOCAL-1'
    );

    expect(result.outcome).toBe('SUCCESS');
    expect(result.providerReference).toBe('SME-REF-123');
    expect(result.token).toBe('8378-9287-1122-3344');
    expect(result.customerName).toBe('MUSA YUSUF');
  });

  it('does not treat a successful status lookup as a successful transaction', () => {
    expect(normaliseSmePurchase({ status: 'success', data: {} }, 'REF-1', { allowGenericStatus: false }).outcome).toBe(
      'UNCERTAIN'
    );
    expect(
      normaliseSmePurchase({ status: 'success', data: { status: 'successful' } }, 'REF-2', {
        allowGenericStatus: false,
      }).outcome
    ).toBe('SUCCESS');
    expect(
      normaliseSmePurchase({ status: 'success', data: { status: 'failed' } }, 'REF-3', {
        allowGenericStatus: false,
      }).outcome
    ).toBe('FAILED');
  });

  it('uses the local reference only as a fallback and preserves safe raw data', () => {
    const result = normaliseSmePurchase(
      { status: 'success', message: 'DATA purchase successful', phone: '08031234567' },
      'TXN-LOCAL-2'
    );

    expect(result.providerReference).toBe('TXN-LOCAL-2');
    expect(result.outcome).toBe('SUCCESS');
    const raw = result.raw as Record<string, unknown>;
    expect(raw.phone).toBe('[REDACTED]');
  });
});
