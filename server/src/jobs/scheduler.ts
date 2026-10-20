import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env, isProduction } from '../config/env';
import { logger } from '../config/logger';
import { syncCatalogue } from '../services/catalogueService';
import { runReconciliationCycle, runWalletDriftCheck } from './reconciliationJobs';

let timers: NodeJS.Timeout[] = [];
let queue: Queue | null = null;
let worker: Worker | null = null;
let redis: IORedis | null = null;

async function execute(jobName: string) {
  if (jobName === 'wallet-drift') {
    return runWalletDriftCheck();
  }
  if (jobName === 'catalogue-sync') {
    try {
      return await syncCatalogue();
    } catch (error) {
      // Keep the last known-good catalogue when the provider is temporarily
      // unavailable. The next scheduled run will retry.
      logger.error({ err: error }, 'Scheduled VTU catalogue sync failed; keeping previous catalogue');
      return null;
    }
  }
  return runReconciliationCycle();
}

async function startBullMq() {
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  redis = connection;
  queue = new Queue('subplug-maintenance', { connection });
  worker = new Worker(
    'subplug-maintenance',
    async (job) => execute(job.name),
    { connection, concurrency: 1 }
  );
  worker.on('failed', (job, error) => {
    logger.error({ job: job?.name, err: error }, 'Background job failed');
  });
  worker.on('completed', (job) => {
    logger.info({ job: job?.name }, 'Background job completed');
  });

  await queue.add(
    'reconcile',
    {},
    {
      repeat: { every: env.RECONCILE_INTERVAL_MS },
      removeOnComplete: 50,
      removeOnFail: 100,
      jobId: 'reconcile-repeat',
    }
  );
  await queue.add(
    'wallet-drift',
    {},
    {
      repeat: { every: 6 * 60 * 60 * 1000 },
      removeOnComplete: 20,
      removeOnFail: 20,
      jobId: 'wallet-drift-repeat',
    }
  );
  await queue.add(
    'catalogue-sync',
    {},
    {
      repeat: { every: env.CATALOGUE_SYNC_INTERVAL_MS },
      removeOnComplete: 20,
      removeOnFail: 50,
      jobId: 'catalogue-sync-repeat',
    }
  );
  logger.info(
    { redis: env.REDIS_URL.replace(/\/\/.*@/, '//***@'), catalogueSyncIntervalMs: env.CATALOGUE_SYNC_INTERVAL_MS },
    'BullMQ scheduler started'
  );
}

export async function startScheduler() {
  if (env.USE_QUEUES) {
    try {
      await startBullMq();
      return;
    } catch (error) {
      logger.error({ err: error }, 'BullMQ failed to start; falling back to in-process scheduler (single instance only)');
    }
  }

  if (isProduction) {
    logger.info('In-process scheduler active. Set USE_QUEUES=true when running multiple API instances.');
  }
  const initial = setTimeout(() => {
    runReconciliationCycle().catch((error) => logger.error({ err: error }, 'Initial reconciliation failed'));
  }, 20_000);
  initial.unref();

  const reconcileTimer = setInterval(() => {
    runReconciliationCycle().catch((error) => logger.error({ err: error }, 'Scheduled reconciliation failed'));
  }, env.RECONCILE_INTERVAL_MS);
  reconcileTimer.unref();
  const driftTimer = setInterval(() => {
    runWalletDriftCheck().catch((error) => logger.error({ err: error }, 'Wallet drift check failed'));
  }, 6 * 60 * 60 * 1000);
  driftTimer.unref();
  const catalogueTimer = setInterval(() => {
    syncCatalogue().catch((error) =>
      logger.error({ err: error }, 'Scheduled VTU catalogue sync failed; keeping previous catalogue')
    );
  }, env.CATALOGUE_SYNC_INTERVAL_MS);
  catalogueTimer.unref();
  timers = [initial, reconcileTimer, driftTimer, catalogueTimer];
  logger.info(
    { intervalMs: env.RECONCILE_INTERVAL_MS, catalogueSyncIntervalMs: env.CATALOGUE_SYNC_INTERVAL_MS },
    'In-process reconciliation scheduler started'
  );
}

export async function stopScheduler() {
  timers.forEach((timer) => clearInterval(timer));
  timers = [];
  if (worker) await worker.close();
  if (queue) await queue.close();
  if (redis) redis.disconnect();
  worker = null;
  queue = null;
  redis = null;
}
