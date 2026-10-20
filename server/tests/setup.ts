import { afterAll, afterEach, beforeAll } from 'vitest';
import {
  AuditLog,
  LedgerEntry,
  Notification,
  PaymentEvent,
  Provider,
  Referral,
  ServicePlan,
  Session,
  SupportTicket,
  SystemSetting,
  Transaction,
  User,
  Wallet,
  WalletFunding,
} from '../src/models';
import { connectDatabase, disconnectDatabase } from '../src/config/db';

if (!process.env.MONGODB_URI?.includes('_test')) {
  throw new Error('Refusing to run tests against a non-test database');
}

async function cleanup() {
  await Promise.all([
    Notification.deleteMany({}),
    Session.deleteMany({}),
    SupportTicket.deleteMany({}),
    ServicePlan.deleteMany({}),
    Provider.deleteMany({}),
    Referral.deleteMany({}),
    PaymentEvent.deleteMany({}),
    WalletFunding.deleteMany({}),
    Transaction.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
    SystemSetting.deleteMany({}),
  ]);
  // Ledger and audit models intentionally block deleteMany; tests clean at the
  // collection level so the immutability guards themselves remain untampered.
  await LedgerEntry.collection.deleteMany({});
  await AuditLog.collection.deleteMany({});
}

beforeAll(async () => {
  await connectDatabase();
  await cleanup();
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await disconnectDatabase();
});
