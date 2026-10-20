import { Notification } from '../models';
import { logger } from '../config/logger';

interface NotificationInput {
  userId: string;
  type: 'SYSTEM' | 'FUNDING' | 'PURCHASE' | 'REFUND' | 'SECURITY' | 'SUPPORT' | 'REFERRAL';
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function notify(input: NotificationInput): Promise<void> {
  try {
    await Notification.create(input);
  } catch (error) {
    logger.error({ err: error, userId: input.userId }, 'Failed to create in-app notification');
  }
}
