import { enabledPaymentGatewayKeys, env } from '../config/env';
import { isPaymentGatewayKey, type PaymentGatewayKey } from '../config/paymentGateways';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';
import { FlutterwaveProvider } from './flutterwaveProvider';
import { MockPaymentProvider } from './mockPaymentProvider';
import { PaystackProvider } from './paystackProvider';
import { PaymentProvider } from './paymentTypes';

const overrides = new Map<string, PaymentProvider>();
const cached = new Map<string, PaymentProvider>();

function createProvider(key: PaymentGatewayKey): PaymentProvider {
  switch (key) {
    case 'mock':
      return new MockPaymentProvider();
    case 'paystack':
      return new PaystackProvider();
    case 'flutterwave':
      return new FlutterwaveProvider();
  }
}

/**
 * Resolves a gateway by key. Omit the key to use the default gateway.
 * Historic fundings keep working even if a gateway is no longer offered in the
 * UI, as long as its credentials are still configured.
 */
export function getPaymentProvider(key: string = env.PAYMENT_GATEWAY): PaymentProvider {
  const override = overrides.get(key);
  if (override) return override;
  const existing = cached.get(key);
  if (existing) return existing;

  if (!isPaymentGatewayKey(key)) {
    throw AppError.serviceUnavailable(`Unknown payment gateway "${key}"`, 'PAYMENT_GATEWAY_UNAVAILABLE');
  }
  if (key === 'mock' && env.NODE_ENV === 'production' && !env.ALLOW_SANDBOX_IN_PRODUCTION) {
    throw AppError.serviceUnavailable('Sandbox payments are disabled in production', 'PAYMENT_GATEWAY_UNAVAILABLE');
  }
  const provider = createProvider(key);
  cached.set(key, provider);
  return provider;
}

/**
 * Gateways offered to customers. A configured gateway that cannot be
 * initialized (for example, missing credentials in development) is omitted
 * rather than breaking the whole settings endpoint.
 */
export function listAvailablePaymentMethods(): Array<{ key: string; name: string; isSandbox: boolean }> {
  const methods: Array<{ key: string; name: string; isSandbox: boolean }> = [];
  for (const key of enabledPaymentGatewayKeys) {
    // The mock gateway exists solely for automated tests. It must never be
    // surfaced to a customer in a running application.
    if (key === 'mock' && env.NODE_ENV !== 'test') continue;
    try {
      const provider = getPaymentProvider(key);
      methods.push({ key: provider.key, name: provider.name, isSandbox: provider.isSandbox });
    } catch (error) {
      logger.warn({ err: error, gateway: key }, 'Enabled payment gateway is not configured');
    }
  }
  return methods;
}

export function isPaymentGatewayEnabled(key: string): boolean {
  return key !== 'mock' || env.NODE_ENV === 'test'
    ? enabledPaymentGatewayKeys.includes(key as PaymentGatewayKey)
    : false;
}

export function setPaymentProviderForTests(provider: PaymentProvider | null, key?: string): void {
  if (provider) {
    const target = key ?? provider.key;
    overrides.set(target, provider);
    cached.set(target, provider);
    return;
  }
  overrides.clear();
  cached.clear();
}
