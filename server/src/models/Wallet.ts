import { Schema, model, Document, Types } from 'mongoose';
import { CURRENCY } from '../config/constants';

export interface IWallet extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  balanceMinor: number;
  currency: string;
  status: 'ACTIVE' | 'FROZEN';
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balanceMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Wallet balances must be integer minor units',
      },
    },
    currency: { type: String, default: CURRENCY, enum: [CURRENCY] },
    status: { type: String, enum: ['ACTIVE', 'FROZEN'], default: 'ACTIVE', index: true },
  },
  { timestamps: true }
);

export const Wallet = model<IWallet>('Wallet', walletSchema);
