import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/subplug_test',
      REQUIRE_REPLICA_SET: 'false',
      JWT_ACCESS_SECRET: 'test-only-access-secret-with-at-least-32-characters',
      ACCESS_TOKEN_TTL_MINUTES: '15',
      REFRESH_TOKEN_TTL_DAYS: '7',
      CLIENT_URL: 'http://localhost:5173',
      API_BASE_URL: 'http://localhost:4000',
      TRUST_PROXY: 'false',
      PAYMENT_GATEWAY: 'mock',
      ALLOW_MOCK_PAYMENTS: 'true',
      PAYSTACK_SECRET_KEY: 'sk_test_subplug_test_secret',
      VTU_PROVIDER: 'mock',
      ALLOW_MOCK_VTU: 'true',
      AUTO_VERIFY_EMAILS: 'true',
      EXPOSE_DEV_EMAILS: 'true',
      USE_QUEUES: 'false',
      LOG_LEVEL: 'silent',
      RATE_LIMIT_MAX: '100000',
      AUTH_RATE_LIMIT_MAX: '100000',
    },
  },
});
