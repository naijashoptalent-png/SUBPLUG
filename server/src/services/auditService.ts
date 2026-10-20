import { Request } from 'express';
import { AuditLog } from '../models';
import { logger } from '../config/logger';

interface AuditInput {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      ip: input.req?.ip ?? null,
      userAgent: input.req?.get('user-agent')?.slice(0, 300) ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    logger.error({ err: error, action: input.action }, 'Failed to write audit log');
  }
}
