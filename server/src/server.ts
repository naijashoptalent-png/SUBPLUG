import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase, supportsTransactions } from './config/db';
import { logger } from './config/logger';
import { ServicePlan, Provider } from './models';
import { getVtuProvider } from './providers';
import { getPaymentProvider } from './providers/paymentIndex';
import { syncCatalogue } from './services/catalogueService';
import { startScheduler, stopScheduler } from './jobs/scheduler';

async function bootstrap() {
  await connectDatabase();

  const app = createApp();
  const server = createServer(app);

  // Local/demo convenience: seed the sandbox catalogue when the database is empty.
  if (env.NODE_ENV !== 'production') {
    try {
      const provider = getVtuProvider();
      await Provider.findOneAndUpdate(
        { key: provider.key },
        {
          $set: {
            name: provider.name,
            kind: 'VTU',
            adapter: provider.key,
            isSandbox: provider.isSandbox,
            enabled: true,
          },
          $setOnInsert: { health: 'UNKNOWN', errorCount: 0 },
        },
        { upsert: true }
      );
      try {
        const payment = getPaymentProvider();
        await Provider.findOneAndUpdate(
          { key: payment.key },
          {
            $set: {
              name: payment.name,
              kind: 'PAYMENT',
              adapter: payment.key,
              isSandbox: payment.isSandbox,
              enabled: true,
            },
            $setOnInsert: { health: 'UNKNOWN', errorCount: 0 },
          },
          { upsert: true }
        );
      } catch (error) {
        logger.warn({ err: error }, 'Payment provider not configured');
      }
      if ((await ServicePlan.countDocuments()) === 0) {
        logger.info('Empty catalogue detected; syncing sandbox catalogue');
        await syncCatalogue();
      }
    } catch (error) {
      logger.warn({ err: error }, 'Could not auto-sync catalogue. Run `npm run seed`.');
    }
  }

  await startScheduler();

  server.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        client: env.CLIENT_URL,
        vtuProvider: env.VTU_PROVIDER,
        paymentGateway: env.PAYMENT_GATEWAY,
        mongoTransactions: supportsTransactions(),
      },
      `SubPlug API listening on http://localhost:${env.PORT}`
    );
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(async () => {
      try {
        await stopScheduler();
        await disconnectDatabase();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ err: error }, 'Error during shutdown');
        process.exit(1);
      }
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception — process will exit');
    setTimeout(() => process.exit(1), 1000);
  });
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
