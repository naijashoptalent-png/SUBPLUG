import { Schema, model, Document, Types } from 'mongoose';

export interface IReferral extends Document {
  referrerId: Types.ObjectId;
  referredUserId: Types.ObjectId;
  code: string;
  status: 'PENDING' | 'QUALIFIED' | 'REWARDED' | 'REJECTED';
  qualifyingTransactionId?: Types.ObjectId | null;
  rewardMinor: number;
  qualifiedAt?: Date | null;
  rewardedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const referralSchema = new Schema<IReferral>(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    code: { type: String, required: true, uppercase: true },
    status: { type: String, enum: ['PENDING', 'QUALIFIED', 'REWARDED', 'REJECTED'], default: 'PENDING', index: true },
    qualifyingTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', default: null },
    rewardMinor: { type: Number, default: 0, min: 0 },
    qualifiedAt: { type: Date, default: null },
    rewardedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

referralSchema.index({ referrerId: 1, status: 1 });

export const Referral = model<IReferral>('Referral', referralSchema);
