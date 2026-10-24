import { Schema, model, Document, Types } from 'mongoose';
import { ROLES, Role } from '../config/constants';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface IUser extends Document {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpiresAt?: Date | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string | null;
  referralCode: string;
  referredBy?: Types.ObjectId | null;
  failedLoginAttempts: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  passwordChangedAt: Date;
  suspensionReason?: string | null;
  virtualAccount?: {
    status: 'ACTIVE' | 'PENDING';
    accountNumber?: string;
    bankName?: string;
    reference?: string;
    createdAt?: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.CUSTOMER, index: true },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'CLOSED'], default: 'ACTIVE', index: true },
    emailVerifiedAt: { type: Date, default: null },
    phoneVerifiedAt: { type: Date, default: null },
    emailVerificationTokenHash: { type: String, default: null, select: false },
    emailVerificationExpiresAt: { type: Date, default: null, select: false },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null, select: false },
    referralCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: () => new Date() },
    suspensionReason: { type: String, default: null, maxlength: 300 },
    // NIN/BVN values are deliberately never persisted. This contains only the
    // non-sensitive details needed to show the assigned funding account.
    virtualAccount: {
      type: new Schema(
        {
          status: { type: String, enum: ['ACTIVE', 'PENDING'], required: true },
          accountNumber: { type: String, trim: true },
          bankName: { type: String, trim: true },
          reference: { type: String, trim: true },
          createdAt: { type: Date },
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { timestamps: true }
);

userSchema.index({ status: 1, createdAt: -1 });
userSchema.index({ fullName: 'text', email: 'text', phone: 'text' });

userSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    delete ret.twoFactorSecret;
    delete ret.emailVerificationTokenHash;
    delete ret.passwordResetTokenHash;
    delete ret.__v;
    return ret;
  },
});

export const User = model<IUser>('User', userSchema);
