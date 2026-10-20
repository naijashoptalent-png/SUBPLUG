import { env, isProduction } from '../config/env';
import { AppError } from '../utils/AppError';
import { MockVtuProvider } from './mockVtuProvider';
import { SmeApiProvider } from './smeApiProvider';
import { VtuProvider } from './types';

let provider: VtuProvider | null = null;

export function getVtuProvider(): VtuProvider {
  if (provider) return provider;
  if (env.VTU_PROVIDER === 'mock') {
    if (isProduction && !env.ALLOW_SANDBOX_IN_PRODUCTION) {
      throw AppError.serviceUnavailable('Mock VTU provider is disabled in production', 'VTU_MOCK_DISABLED');
    }
    provider = new MockVtuProvider();
  } else {
    provider = new SmeApiProvider();
  }
  return provider;
}

export function setVtuProviderForTests(instance: VtuProvider | null): void {
  provider = instance;
}

export type { VtuProvider } from './types';
