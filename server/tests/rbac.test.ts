import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { COOKIES, Role } from '../src/config/constants';
import { Transaction } from '../src/models';
import { signAccessToken } from '../src/services/tokenService';
import { createUser, uniqueReference } from './helpers';

const app = createApp();
const CSRF_TOKEN = 'test-csrf-token';

function cookieFor(user: { _id: unknown; role: Role }) {
  return `${COOKIES.access}=${signAccessToken(String(user._id), user.role)}; ${COOKIES.csrf}=${CSRF_TOKEN}`;
}

function authenticated<T extends { set(field: string, value: string): T }>(
  req: T,
  user: { _id: unknown; role: Role }
): T {
  return req.set('Cookie', cookieFor(user)).set('X-CSRF-Token', CSRF_TOKEN);
}

async function createTransaction(
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  return Transaction.create({
    reference: uniqueReference('TXN'),
    userId,
    service: 'AIRTIME',
    amountMinor: 5_000,
    payableMinor: 4_900,
    discountMinor: 100,
    costMinor: 4_900,
    marginMinor: 0,
    status: 'SUCCESSFUL',
    statusHistory: [{ status: 'SUCCESSFUL', at: new Date() }],
    provider: 'mock',
    idempotencyKey: uniqueReference('IDEM'),
    requestHash: 'test-request-hash',
    recipient: { phone: '+2348012345678', network: 'MTN' },
    ...overrides,
  });
}

describe('authentication and role boundaries', () => {
  it('requires authentication for admin endpoints', async () => {
    const response = await request(app).get('/api/v1/admin/overview');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('denies customers access to operational admin views', async () => {
    const customer = await createUser();

    const overview = await request(app)
      .get('/api/v1/admin/overview')
      .set('Cookie', cookieFor(customer));
    const users = await request(app).get('/api/v1/admin/users').set('Cookie', cookieFor(customer));

    expect(overview.status).toBe(403);
    expect(overview.body.error.code).toBe('INSUFFICIENT_ROLE');
    expect(users.status).toBe(403);
  });

  it('allows support to read operations but not admin-only settings', async () => {
    const support = await createUser({ role: 'SUPPORT' });

    const overview = await request(app)
      .get('/api/v1/admin/overview')
      .set('Cookie', cookieFor(support));
    const settings = await request(app)
      .get('/api/v1/admin/settings')
      .set('Cookie', cookieFor(support));

    expect(overview.status).toBe(200);
    expect(overview.body.data).toHaveProperty('users');
    expect(settings.status).toBe(403);
    expect(settings.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('allows admins to read settings and blocks unconfirmed maintenance mode', async () => {
    const admin = await createUser({ role: 'ADMIN' });

    const settings = await request(app)
      .get('/api/v1/admin/settings')
      .set('Cookie', cookieFor(admin));
    const maintenance = await authenticated(
      request(app).patch('/api/v1/admin/settings'),
      admin
    ).send({ key: 'maintenance', value: { enabled: true } });

    expect(settings.status).toBe(200);
    expect(settings.body.data).toHaveProperty('branding');
    expect(settings.body.data).toHaveProperty('limits');
    expect(maintenance.status).toBe(400);
    expect(maintenance.body.error.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('prevents support from mutating accounts or wallets', async () => {
    const support = await createUser({ role: 'SUPPORT' });
    const customer = await createUser();

    const status = await authenticated(
      request(app).patch(`/api/v1/admin/users/${String(customer._id)}/status`),
      support
    ).send({ status: 'SUSPENDED', reason: 'Support should not be able to do this' });
    const adjustment = await authenticated(
      request(app).post('/api/v1/admin/wallet/adjust'),
      support
    ).send({
      userId: String(customer._id),
      amountMinor: 5_000,
      direction: 'CREDIT',
      reason: 'Support should not be able to do this',
      idempotencyKey: 'support-adjust-1',
    });

    expect(status.status).toBe(403);
    expect(adjustment.status).toBe(403);
    expect(adjustment.body.error.code).toBe('INSUFFICIENT_ROLE');
  });
});

describe('CSRF and idempotency enforcement', () => {
  it('rejects unsafe requests without matching CSRF cookie and header', async () => {
    const customer = await createUser();

    const response = await request(app)
      .post('/api/v1/wallet/fund')
      .set('Cookie', `${COOKIES.access}=${signAccessToken(String(customer._id), 'CUSTOMER')}`)
      .set('Idempotency-Key', 'funding-key-123')
      .send({ amountMinor: 10_000 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('requires an idempotency key for wallet funding and processes sandbox checkout once', async () => {
    const customer = await createUser();

    const missingKey = await authenticated(
      request(app).post('/api/v1/wallet/fund'),
      customer
    ).send({ amountMinor: 10_000 });
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const created = await authenticated(request(app).post('/api/v1/wallet/fund'), customer)
      .set('Idempotency-Key', 'funding-key-456')
      .send({ amountMinor: 10_000 });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('PENDING');

    const duplicate = await authenticated(request(app).post('/api/v1/wallet/fund'), customer)
      .set('Idempotency-Key', 'funding-key-456')
      .send({ amountMinor: 10_000 });
    expect(duplicate.status).toBe(201);
    expect(duplicate.body.data.duplicate).toBe(true);
    expect(duplicate.body.data.reference).toBe(created.body.data.reference);

    const simulated = await authenticated(
      request(app).post(`/api/v1/wallet/funding/${created.body.data.reference}/simulate`),
      customer
    ).send({ outcome: 'success' });
    expect(simulated.status).toBe(200);
    expect(simulated.body.data.status).toBe('SUCCESSFUL');

    const wallet = await request(app)
      .get('/api/v1/wallet')
      .set('Cookie', cookieFor(customer));
    expect(wallet.status).toBe(200);
    expect(wallet.body.data.wallet.balanceMinor).toBe(10_000);
  });
});

describe('admin account state and wallet adjustments', () => {
  it('allows only admins to suspend accounts and enforces the suspension immediately', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const customer = await createUser();

    const suspended = await authenticated(
      request(app).patch(`/api/v1/admin/users/${String(customer._id)}/status`),
      admin
    ).send({ status: 'SUSPENDED', reason: 'Fraud investigation' });

    expect(suspended.status).toBe(200);
    expect(suspended.body.data.status).toBe('SUSPENDED');

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookieFor(customer));
    expect(me.status).toBe(403);
    expect(me.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('allows only admins to adjust wallets and records an audit trail', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const customer = await createUser();

    const adjusted = await authenticated(request(app).post('/api/v1/admin/wallet/adjust'), admin)
      .send({
        userId: String(customer._id),
        amountMinor: 5_000,
        direction: 'CREDIT',
        reason: 'Goodwill credit for an outage',
        idempotencyKey: 'admin-adjust-key-1',
      });

    expect(adjusted.status).toBe(200);
    expect(adjusted.body.data.type).toBe('ADJUSTMENT_CREDIT');
    expect(adjusted.body.data.balanceAfterMinor).toBe(5_000);

    const wallet = await request(app)
      .get('/api/v1/wallet')
      .set('Cookie', cookieFor(customer));
    expect(wallet.body.data.wallet.balanceMinor).toBe(5_000);

    const audit = await request(app)
      .get('/api/v1/admin/audit-logs?action=WALLET_ADJUSTED')
      .set('Cookie', cookieFor(admin));
    expect(audit.status).toBe(200);
    expect(audit.body.data.logs).toHaveLength(1);
    expect(audit.body.data.logs[0].metadata.amountMinor).toBe(5_000);
    expect(String(audit.body.data.logs[0].actorId)).toBe(String(admin._id));
  });
});

describe('transaction ownership boundaries', () => {
  it('hides another customer’s transaction while allowing staff read-only access', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const support = await createUser({ role: 'SUPPORT' });
    const owner = await createUser();
    const other = await createUser();
    const transaction = await createTransaction(String(owner._id));

    const otherView = await request(app)
      .get(`/api/v1/purchases/${transaction.reference}`)
      .set('Cookie', cookieFor(other));
    expect(otherView.status).toBe(404);

    const ownerView = await request(app)
      .get(`/api/v1/purchases/${transaction.reference}`)
      .set('Cookie', cookieFor(owner));
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.data.reference).toBe(transaction.reference);
    expect(ownerView.body.data.userId).toBeUndefined();
    expect(ownerView.body.data.costMinor).toBeUndefined();

    const adminView = await request(app)
      .get(`/api/v1/admin/transactions/${transaction.reference}`)
      .set('Cookie', cookieFor(admin));
    expect(adminView.status).toBe(200);
    expect(adminView.body.data.userId).toBe(String(owner._id));
    expect(adminView.body.data.costMinor).toBe(4_900);

    const supportView = await request(app)
      .get(`/api/v1/admin/transactions/${transaction.reference}`)
      .set('Cookie', cookieFor(support));
    expect(supportView.status).toBe(200);
    expect(supportView.body.data.reference).toBe(transaction.reference);
  });

  it('lists only the customer’s own transactions on the customer endpoint', async () => {
    const customer = await createUser();
    const other = await createUser();
    const own = await createTransaction(String(customer._id));
    await createTransaction(String(other._id));

    const response = await request(app)
      .get('/api/v1/purchases')
      .set('Cookie', cookieFor(customer));

    expect(response.status).toBe(200);
    expect(response.body.data.transactions).toHaveLength(1);
    expect(response.body.data.transactions[0].reference).toBe(own.reference);
  });
});
