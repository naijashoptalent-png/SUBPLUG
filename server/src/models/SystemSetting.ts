import { Schema, model, Document, Types } from 'mongoose';

export interface ISystemSetting extends Document {
  key: string;
  value: unknown;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const systemSettingSchema = new Schema<ISystemSetting>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const SystemSetting = model<ISystemSetting>('SystemSetting', systemSettingSchema);
