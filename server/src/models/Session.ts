import { Schema, model, Document, Types } from 'mongoose';

/** Refresh-token sessions. Only a hash of the refresh token is stored. */
export interface ISession extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  userAgent?: string | null;
  ip?: string | null;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedByTokenHash?: string | null;
  createdAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    userAgent: { type: String, default: null, maxlength: 300 },
    ip: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model<ISession>('Session', sessionSchema);
