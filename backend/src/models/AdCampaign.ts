import mongoose, { Document, Schema, Model } from 'mongoose';

export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'REMOVED' | 'UNKNOWN';

export interface ICampaignMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
  cpa: number;
  roas?: number;
}

export interface IAdCampaign extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  platform: 'meta' | 'google';
  externalCampaignId: string;
  name: string;
  status: CampaignStatus;
  objective?: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  currency: string;
  startTime?: Date;
  endTime?: Date;
  metrics: ICampaignMetrics;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MetricsSchema = new Schema<ICampaignMetrics>(
  {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    spend: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    leads: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    cpc: { type: Number, default: 0 },
    cpm: { type: Number, default: 0 },
    cpl: { type: Number, default: 0 },
    cpa: { type: Number, default: 0 },
    roas: { type: Number },
  },
  { _id: false }
);

const AdCampaignSchema = new Schema<IAdCampaign>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
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
      index: true,
    },
    externalCampaignId: {
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
      enum: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'REMOVED', 'UNKNOWN'],
      default: 'ACTIVE',
      index: true,
    },
    objective: {
      type: String,
      trim: true,
    },
    dailyBudget: {
      type: Number,
    },
    lifetimeBudget: {
      type: Number,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    metrics: {
      type: MetricsSchema,
      default: () => ({
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        leads: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        cpl: 0,
        cpa: 0,
      }),
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

AdCampaignSchema.index(
  { clientId: 1, platform: 1, externalCampaignId: 1 },
  { unique: true }
);
AdCampaignSchema.index({ clientId: 1, lastSyncedAt: -1 });

export const AdCampaign: Model<IAdCampaign> =
  mongoose.models.AdCampaign ||
  mongoose.model<IAdCampaign>('AdCampaign', AdCampaignSchema);
