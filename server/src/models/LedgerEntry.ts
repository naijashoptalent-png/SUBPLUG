import { Schema, model, Document, Types } from 'mongoose';
import { CURRENCY, LEDGER_TYPES, LedgerType } from '../config/constants';

/**
 * Immutable double-entry-style audit ledger. The wallet balance is a cached
 * projection; the ledger is the financial source of truth for reconciliation.
 * Rows are never updated or deleted by application code.
 */
export interface ILedgerEntry extends Document {
  _id: Types.ObjectId;
  walletId: Types.ObjectId;
  userId: Types.ObjectId;
  type: LedgerType;
  direction: 'CREDIT' | 'DEBIT';
  amountMinor: number;
  balanceAfterMinor: number;
  currency: string;
  reference: string;
  idempotencyKey: string;
  description: string;
  transactionId?: Types.ObjectId | null;
  fundingId?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const ledgerEntrySchema = new Schema<ILedgerEntry>(
  {
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: LEDGER_TYPES, required: true, index: true },
    direction: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    amountMinor: {
      type: Number,
      required: true,
      validate: { validator: (v: number) => Number.isSafeInteger(v) && v > 0, message: 'Ledger amount must be a positive integer' },
    },
    balanceAfterMinor: {
      type: Number,
      required: true,
      validate: { validator: (v: number) => Number.isSafeInteger(v) && v >= 0, message: 'Balance cannot be negative' },
    },
    currency: { type: String, default: CURRENCY, enum: [CURRENCY] },
    reference: { type: String, required: true, unique: true },
    idempotencyKey: { type: String, required: true, unique: true },
    description: { type: String, required: true, maxlength: 300 },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', default: null, index: true },
    fundingId: { type: Schema.Types.ObjectId, ref: 'WalletFunding', default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ledgerEntrySchema.index({ walletId: 1, createdAt: -1 });
ledgerEntrySchema.index({ userId: 1, createdAt: -1 });

function blockMutation(this: unknown, next: (err?: Error) => void) {
  next(new Error('Ledger entries are immutable'));
}

ledgerEntrySchema.pre('updateOne', blockMutation);
ledgerEntrySchema.pre('updateMany', blockMutation);
ledgerEntrySchema.pre('findOneAndUpdate', blockMutation);
ledgerEntrySchema.pre('deleteOne', blockMutation);
ledgerEntrySchema.pre('deleteMany', blockMutation);

export const LedgerEntry = model<ILedgerEntry>('LedgerEntry', ledgerEntrySchema);
