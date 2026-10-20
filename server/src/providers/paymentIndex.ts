import { env } from '../config/env';
import { MockPaymentProvider } from './mockPaymentProvider';
import { PaystackProvider } from './paystackProvider';
import { PaymentProvider } from './paymentTypes';

let override: PaymentProvider | null = null;
let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (override) return override;
  if (cached) return cached;
  if (env.PAYMENT_GATEWAY === 'mock') {
    if (env.NODE_ENV === 'production' && !env.ALLOW_SANDBOX_IN_PRODUCTION) {
      throw new Error('Sandbox payments are disabled in production');
    }
    cached = new MockPaymentProvider();
  } else {
    cached = new PaystackProvider();
  }
  return cached;
}

export function setPaymentProviderForTests(provider: PaymentProvider | null): void {
  override = provider;
  if (provider) cached = provider;
}
