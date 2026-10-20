import { Schema, model, Document } from 'mongoose';

/** Durable, de-duplicated record of every signed payment webhook received. */
export interface IPaymentEvent extends Document {
  gateway: string;
  eventId: string;
  eventType: string;
  reference: string;
  signatureVerified: boolean;
  payload: Record<string, unknown>;
  processed: boolean;
  processingError?: string | null;
  processedAt?: Date | null;
  createdAt: Date;
}

const paymentEventSchema = new Schema<IPaymentEvent>(
  {
    gateway: { type: String, required: true },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    reference: { type: String, required: true, index: true },
    signatureVerified: { type: Boolean, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    processed: { type: Boolean, default: false, index: true },
    processingError: { type: String, default: null, maxlength: 500 },
    processedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

paymentEventSchema.index({ gateway: 1, eventId: 1 }, { unique: true });
paymentEventSchema.index({ createdAt: -1 });

export const PaymentEvent = model<IPaymentEvent>('PaymentEvent', paymentEventSchema);
