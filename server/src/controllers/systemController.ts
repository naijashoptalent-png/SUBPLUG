import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { getPublicSettings } from '../services/settingsService';
import { supportsTransactions } from '../config/db';
import { getVtuProvider } from '../providers';

export const health = asyncHandler(async (_req: Request, res: Response) => {
  const dbReady = mongoose.connection.readyState === 1;
  const status = dbReady ? 'ok' : 'degraded';
  res.status(dbReady ? 200 : 503).json({
    data: {
      status,
      database: dbReady ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
    },
  });
});

export const readiness = asyncHandler(async (_req: Request, res: Response) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    data: {
      ready: dbReady,
      mongoTransactions: supportsTransactions(),
      provider: getVtuProvider().key,
    },
  });
});

export const statusPage = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getPublicSettings();
  const vtu = getVtuProvider();
  res.json({
    data: {
      maintenance: settings.maintenance,
      support: settings.support,
      branding: settings.branding,
      provider: { key: vtu.key, isSandbox: vtu.isSandbox },
      time: new Date().toISOString(),
    },
  });
});
