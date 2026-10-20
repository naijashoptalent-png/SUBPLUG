import { Schema, model, Document, Types } from 'mongoose';

export interface ITicketMessage {
  authorId: Types.ObjectId;
  authorRole: 'CUSTOMER' | 'SUPPORT' | 'ADMIN';
  authorName: string;
  body: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  reference: string;
  userId: Types.ObjectId;
  subject: string;
  category: 'TRANSACTION_DISPUTE' | 'WALLET' | 'ACCOUNT' | 'OTHER';
  transactionReference?: string | null;
  transactionId?: Types.ObjectId | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  messages: ITicketMessage[];
  lastMessageAt: Date;
  closedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<ITicketMessage>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: ['CUSTOMER', 'SUPPORT', 'ADMIN'], required: true },
    authorName: { type: String, required: true },
    body: { type: String, required: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    reference: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, maxlength: 150 },
    category: {
      type: String,
      enum: ['TRANSACTION_DISPUTE', 'WALLET', 'ACCOUNT', 'OTHER'],
      required: true,
    },
    transactionReference: { type: String, default: null, index: true },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', default: null },
    status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], default: 'OPEN', index: true },
    priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH'], default: 'NORMAL' },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supportTicketSchema.index({ status: 1, lastMessageAt: -1 });

export const SupportTicket = model<ISupportTicket>('SupportTicket', supportTicketSchema);
