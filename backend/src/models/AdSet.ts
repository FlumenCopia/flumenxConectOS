import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAdSetMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  leads: number;
}

export interface IAdSet extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  platform: 'meta' | 'google';
  externalAdSetId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'UNKNOWN';
  dailyBudget?: number;
  targetingSummary?: Record<string, any>;
  metrics: IAdSetMetrics;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdSetSchema = new Schema<IAdSet>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'AdCampaign',
      required: true,
      index: true,
    },
    connectionId: {
      type: Schema.Types.ObjectId,
      ref: 'AdPlatformConnection',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['meta', 'google'],
      required: true,
    },
    externalAdSetId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'UNKNOWN'],
      default: 'ACTIVE',
    },
    dailyBudget: {
      type: Number,
    },
    targetingSummary: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      spend: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      leads: { type: Number, default: 0 },
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

AdSetSchema.index({ clientId: 1, externalAdSetId: 1 });

export const AdSet: Model<IAdSet> =
  mongoose.models.AdSet || mongoose.model<IAdSet>('AdSet', AdSetSchema);
