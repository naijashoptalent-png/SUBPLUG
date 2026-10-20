import { Schema, model, Document } from 'mongoose';

export interface IProvider extends Document {
  key: string;
  name: string;
  kind: 'VTU' | 'PAYMENT' | 'EMAIL';
  adapter: string;
  enabled: boolean;
  isSandbox: boolean;
  health: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  lastCheckedAt?: Date | null;
  lastError?: string | null;
  errorCount: number;
  config?: Record<string, unknown>; // never store secrets here
  createdAt: Date;
  updatedAt: Date;
}

const providerSchema = new Schema<IProvider>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['VTU', 'PAYMENT', 'EMAIL'], required: true },
    adapter: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    isSandbox: { type: Boolean, default: true },
    health: { type: String, enum: ['HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN'], default: 'UNKNOWN' },
    lastCheckedAt: { type: Date, default: null },
    lastError: { type: String, default: null, maxlength: 500 },
    errorCount: { type: Number, default: 0 },
    config: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Provider = model<IProvider>('Provider', providerSchema);
