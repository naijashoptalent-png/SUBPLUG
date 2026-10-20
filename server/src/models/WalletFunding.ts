import { Schema, model, Document, Types } from 'mongoose';
import { CURRENCY, FUNDING_STATUSES, FundingStatus } from '../config/constants';

export interface IWalletFunding extends Document {
  _id: Types.ObjectId;
  reference: string;
  userId: Types.ObjectId;
  amountMinor: number;
  currency: string;
  status: FundingStatus;
  gateway: string;
  gatewayReference?: string | null;
  authorizationUrl?: string | null;
  accessCode?: string | null;
  idempotencyKey: string;
  requestHash: string;
  isSandbox: boolean;
  gatewayPayload?: Record<string, unknown> | null;
  paidAt?: Date | null;
  verifiedAt?: Date | null;
  creditedAt?: Date | null;
  failureReason?: string | null;
  reviewReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const walletFundingSchema = new Schema<IWalletFunding>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountMinor: {
      type: Number,
      required: true,
      min: 100,
      validate: { validator: Number.isSafeInteger, message: 'Funding amount must be integer minor units' },
    },
    currency: { type: String, default: CURRENCY, enum: [CURRENCY] },
    status: { type: String, enum: FUNDING_STATUSES, default: 'PENDING', index: true },
    gateway: { type: String, required: true, index: true },
    gatewayReference: { type: String, default: null, index: true },
    authorizationUrl: { type: String, default: null },
    accessCode: { type: String, default: null, select: false },
    idempotencyKey: { type: String, required: true },
    requestHash: { type: String, required: true },
    isSandbox: { type: Boolean, default: false },
    gatewayPayload: { type: Schema.Types.Mixed, default: null },
    paidAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    creditedAt: { type: Date, default: null },
    failureReason: { type: String, default: null, maxlength: 500 },
    reviewReason: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true }
);

walletFundingSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
walletFundingSchema.index({ userId: 1, createdAt: -1 });
walletFundingSchema.index({ status: 1, createdAt: -1 });

export const WalletFunding = model<IWalletFunding>('WalletFunding', walletFundingSchema);
