import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IQuickReply extends Document {
  clientId: Types.ObjectId;
  title: string;
  category?: string;
  body: string;
  channel?: string;
  tags?: string[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuickReplySchema = new Schema<IQuickReply>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, default: 'General' },
    body: { type: String, required: true, trim: true },
    channel: { type: String, default: 'whatsapp' },
    tags: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false }
);

export const QuickReply =
  mongoose.models.QuickReply || mongoose.model<IQuickReply>('QuickReply', QuickReplySchema);
