import { createServer } from 'http';
import { createApp } from './app';
import { env, enabledPaymentGatewayKeys } from './config/env';
import { connectDatabase, disconnectDatabase, supportsTransactions } from './config/db';
import { logger } from './config/logger';
import { ServicePlan, Provider } from './models';
import { getConfiguredProviderKeys, getServiceProviderKey, getVtuProviderByKey, loadProviderRouting } from './providers';
import { getPaymentProvider } from './providers/paymentIndex';
import { syncCatalogue } from './services/catalogueService';
import { startScheduler, stopScheduler } from './jobs/scheduler';

async function bootstrap() {
  await connectDatabase();
  // Runtime routing is persisted so an admin switch survives a restart. The
  // environment route remains the fallback when no override has been saved.
  await loadProviderRouting();

  const app = createApp();
  const server = createServer(app);

  // Local convenience: sync the catalogue for the active VTU provider when it
  // has no products yet. Never overwrites a synced or manually curated catalogue.
  if (env.NODE_ENV !== 'production') {
    try {
      for (const key of getConfiguredProviderKeys()) {
        try {
          const configured = getVtuProviderByKey(key);
          await Provider.findOneAndUpdate(
            { key: configured.key },
            {
              $set: {
                name: configured.name,
                kind: 'VTU',
                adapter: configured.key,
                isSandbox: configured.isSandbox,
                enabled: true,
              },
              $setOnInsert: { health: 'UNKNOWN', errorCount: 0 },
            },
            { upsert: true }
          );
        } catch (error) {
          logger.warn({ err: error, provider: key }, 'Configured VTU provider could not be initialized');
        }
      }
      try {
        for (const key of enabledPaymentGatewayKeys) {
          try {
            const payment = getPaymentProvider(key);
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
            logger.warn({ err: error, gateway: key }, 'Payment gateway not configured');
          }
        }
      } catch (error) {
        logger.warn({ err: error }, 'Payment providers could not be inspected');
      }
      let needsSync = false;
      for (const key of getConfiguredProviderKeys()) {
        const services = (['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE'] as const).filter(
          (service) => getServiceProviderKey(service) === key
        );
        if (!services.length) continue;
        const count = await ServicePlan.countDocuments({ provider: key, service: { $in: services }, enabled: true });
        if (count === 0) {
          needsSync = true;
          break;
        }
      }
      if (needsSync) {
        logger.info({ providers: getConfiguredProviderKeys() }, 'No catalogue for an active VTU route; syncing');
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
        paymentGateways: enabledPaymentGatewayKeys,
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
