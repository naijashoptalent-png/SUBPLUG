import { connectDatabase, disconnectDatabase } from '../config/db';
import { logger } from '../config/logger';
import { DEFAULT_SETTINGS, SETTING_KEYS } from '../config/constants';
import { SystemSetting } from '../models';
import { syncCatalogue } from '../services/catalogueService';
import { seedAdmin } from './seedAdmin';
import { env } from '../config/env';

async function seed() {
  await connectDatabase();

  for (const key of Object.values(SETTING_KEYS)) {
    await SystemSetting.updateOne(
      { key },
      { $setOnInsert: { key, value: DEFAULT_SETTINGS[key] } },
      { upsert: true }
    );
  }
  logger.info('Default system settings ensured (existing settings not overwritten)');

  if (env.VTU_PROVIDER !== 'mock' && (!env.VTU_API_BASE_URL || !env.VTU_API_KEY)) {
    throw new Error(
      `VTU_PROVIDER=${env.VTU_PROVIDER} requires VTU_API_BASE_URL and VTU_API_KEY. Catalogue was not synced.`
    );
  }
  const sync = await syncCatalogue();
  logger.info(sync, 'Catalogue synchronized');

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    await seedAdmin();
  } else {
    logger.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set — no administrator was seeded');
  }
}

 seed().then(async () => {
  await disconnectDatabase();
  logger.info('Seed complete');
  process.exit(0);
}).catch(async (error) => {
  logger.fatal({ err: error }, 'Seed failed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
