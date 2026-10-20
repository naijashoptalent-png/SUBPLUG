import mongoose from 'mongoose';
import { env, isProduction } from './env';
import { logger } from './logger';

let transactionsSupported = false;

export async function connectDatabase(uri = env.MONGODB_URI): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
  });

  try {
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    transactionsSupported = Boolean(hello.setName);
  } catch {
    transactionsSupported = false;
  }

  if (!transactionsSupported) {
    const message =
      'MongoDB is running as a standalone server. Multi-document transactions are unavailable. ' +
      'Wallet operations use a serialized fallback for local development only. Production requires a replica set.';
    if (env.REQUIRE_REPLICA_SET && isProduction) {
      throw new Error(message);
    }
    logger.warn(message);
  } else {
    logger.info({ replicaSet: (await mongoose.connection.db!.admin().command({ hello: 1 })).setName }, 'MongoDB replica set connected');
  }

  logger.info('MongoDB connected');
}

export function supportsTransactions(): boolean {
  return transactionsSupported;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
