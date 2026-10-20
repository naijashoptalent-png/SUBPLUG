import { Schema, model, Document, Types } from 'mongoose';
import { SERVICE_TYPES, ServiceType } from '../config/constants';

/**
 * Server-owned catalogue. Prices sent by clients are never trusted.
 * For airtime, plans are not used; discounts come from system settings.
 * For data/cable, `costMinor` is provider cost and `sellingPriceMinor` is the
 * customer price. For electricity, amounts are entered by the user.
 */
export interface IServicePlan extends Document {
  _id: Types.ObjectId;
  provider: string;
  service: ServiceType;
  network?: string | null; // data network, cable provider, or disco code
  providerPlanId: string;
  name: string;
  dataVolume?: string | null;
  validity?: string | null;
  costMinor: number;
  sellingPriceMinor: number;
  enabled: boolean;
  isSandbox: boolean;
  metadata?: Record<string, unknown>;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const servicePlanSchema = new Schema<IServicePlan>(
  {
    provider: { type: String, required: true, index: true },
    service: { type: String, enum: SERVICE_TYPES, required: true, index: true },
    network: { type: String, default: null, uppercase: true, trim: true },
    providerPlanId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    dataVolume: { type: String, default: null },
    validity: { type: String, default: null },
    costMinor: { type: Number, required: true, min: 0 },
    sellingPriceMinor: { type: Number, required: true, min: 1 },
    enabled: { type: Boolean, default: true, index: true },
    isSandbox: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

servicePlanSchema.index(
  { provider: 1, service: 1, providerPlanId: 1 },
  { unique: true }
);
servicePlanSchema.index({ service: 1, network: 1, enabled: 1 });

export const ServicePlan = model<IServicePlan>('ServicePlan', servicePlanSchema);
