import { Schema, model, Document, Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: 'SYSTEM' | 'FUNDING' | 'PURCHASE' | 'REFUND' | 'SECURITY' | 'SUPPORT' | 'REFERRAL';
  title: string;
  body: string;
  link?: string | null;
  readAt?: Date | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['SYSTEM', 'FUNDING', 'PURCHASE', 'REFUND', 'SECURITY', 'SUPPORT', 'REFERRAL'],
      default: 'SYSTEM',
    },
    title: { type: String, required: true, maxlength: 150 },
    body: { type: String, required: true, maxlength: 1000 },
    link: { type: String, default: null, maxlength: 300 },
    readAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });

export const Notification = model<INotification>('Notification', notificationSchema);
