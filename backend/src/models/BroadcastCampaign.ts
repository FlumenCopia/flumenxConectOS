import mongoose, { Document, Schema, Model } from 'mongoose';

export type BroadcastChannel = 'whatsapp' | 'sms' | 'email';
export type BroadcastStatus = 'draft' | 'sending' | 'completed' | 'partial_failure' | 'failed';

export interface IBroadcastAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface IBroadcastRecipientItem {
  name: string;
  phone: string;
  email?: string;
  customFields?: Record<string, string>;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  messageId?: string;
  sentAt?: Date;
}

export interface IBroadcastCampaign extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  name: string;
  channel: BroadcastChannel;
  messageBody: string;
  attachment?: IBroadcastAttachment;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  status: BroadcastStatus;
  recipients: IBroadcastRecipientItem[];
  createdBy?: mongoose.Types.ObjectId;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BroadcastAttachmentSchema = new Schema<IBroadcastAttachment>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
  },
  { _id: false }
);

const BroadcastRecipientSchema = new Schema<IBroadcastRecipientItem>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    customFields: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    error: { type: String },
    messageId: { type: String },
    sentAt: { type: Date },
  },
  { _id: false }
);

const BroadcastCampaignSchema = new Schema<IBroadcastCampaign>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'sms', 'email'],
      default: 'whatsapp',
      required: true,
    },
    messageBody: {
      type: String,
      required: true,
    },
    attachment: {
      type: BroadcastAttachmentSchema,
      required: false,
    },
    totalRecipients: {
      type: Number,
      default: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'sending', 'completed', 'partial_failure', 'failed'],
      default: 'completed',
      index: true,
    },
    recipients: {
      type: [BroadcastRecipientSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

BroadcastCampaignSchema.index({ clientId: 1, createdAt: -1 });

export const BroadcastCampaign: Model<IBroadcastCampaign> =
  mongoose.models.BroadcastCampaign ||
  mongoose.model<IBroadcastCampaign>('BroadcastCampaign', BroadcastCampaignSchema);
