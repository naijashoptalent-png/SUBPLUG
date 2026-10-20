import { Schema, model, Document, Types } from 'mongoose';
import {
  CURRENCY,
  SERVICE_TYPES,
  ServiceType,
  TRANSACTION_STATUSES,
  TransactionStatus,
} from '../config/constants';

export interface IStatusHistory {
  status: TransactionStatus;
  at: Date;
  reason?: string;
  actorId?: Types.ObjectId | null;
}

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  reference: string;
  userId: Types.ObjectId;
  service: ServiceType;
  amountMinor: number; // face value delivered (e.g. airtime value)
  payableMinor: number; // amount debited from wallet
  feeMinor: number;
  discountMinor: number;
  costMinor: number; // provider cost (admin-only)
  marginMinor: number; // platform gross margin
  currency: string;
  status: TransactionStatus;
  statusHistory: IStatusHistory[];
  provider: string;
  providerReference?: string | null;
  providerStatus?: string | null;
  providerPayload?: Record<string, unknown> | null;
  providerSubmittedAt?: Date | null;
  reviewReason?: string | null;
  metadata?: Record<string, unknown> | null;
  idempotencyKey: string;
  requestHash: string;
  paymentMethod: 'WALLET';
  recipient: {
    phone?: string;
    meterNumber?: string;
    meterType?: 'PREPAID' | 'POSTPAID';
    smartcardNumber?: string;
    customerName?: string;
    disco?: string;
    cableProvider?: string;
    network?: string;
  };
  plan?: {
    code?: string;
    name?: string;
    dataVolume?: string;
    validity?: string;
  };
  fulfillment?: {
    token?: string | null;
    units?: string | null;
    customerName?: string | null;
    customerAddress?: string | null;
  };
  failureReason?: string | null;
  refundedAt?: Date | null;
  refundedAmountMinor?: number;
  reconciledAt?: Date | null;
  nextReconcileAt?: Date | null;
  reconciliationAttempts: number;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    service: { type: String, enum: SERVICE_TYPES, required: true, index: true },
    amountMinor: { type: Number, required: true, min: 1 },
    payableMinor: { type: Number, required: true, min: 1 },
    feeMinor: { type: Number, default: 0, min: 0 },
    discountMinor: { type: Number, default: 0, min: 0 },
    costMinor: { type: Number, default: 0, min: 0 },
    marginMinor: { type: Number, default: 0 },
    currency: { type: String, default: CURRENCY, enum: [CURRENCY] },
    status: { type: String, enum: TRANSACTION_STATUSES, default: 'CREATED', index: true },
    statusHistory: [
      {
        status: { type: String, enum: TRANSACTION_STATUSES, required: true },
        at: { type: Date, default: Date.now },
        reason: { type: String, maxlength: 300 },
        actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],
    provider: { type: String, required: true, index: true },
    providerReference: { type: String, default: null, index: true },
    providerStatus: { type: String, default: null },
    providerPayload: { type: Schema.Types.Mixed, default: null },
    providerSubmittedAt: { type: Date, default: null },
    reviewReason: { type: String, default: null, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    idempotencyKey: { type: String, required: true },
    requestHash: { type: String, required: true },
    paymentMethod: { type: String, enum: ['WALLET'], default: 'WALLET' },
    recipient: {
      phone: String,
      meterNumber: String,
      meterType: { type: String, enum: ['PREPAID', 'POSTPAID'] },
      smartcardNumber: String,
      customerName: String,
      disco: String,
      cableProvider: String,
      network: String,
    },
    plan: { code: String, name: String, dataVolume: String, validity: String },
    fulfillment: {
      token: { type: String, default: null, select: false },
      units: { type: String, default: null, select: false },
      customerName: { type: String, default: null },
      customerAddress: { type: String, default: null },
    },
    failureReason: { type: String, default: null, maxlength: 500 },
    refundedAt: { type: Date, default: null },
    refundedAmountMinor: { type: Number, default: 0 },
    reconciledAt: { type: Date, default: null },
    nextReconcileAt: { type: Date, default: null, index: true },
    reconciliationAttempts: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ provider: 1, status: 1 });
transactionSchema.index({ 'recipient.phone': 1 });

export const Transaction = model<ITransaction>('Transaction', transactionSchema);
