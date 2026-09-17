import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAdCreative {
  headline?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  callToAction?: string;
  destinationUrl?: string;
}

export interface IAdMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  leads: number;
}

export interface IAd extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  adSetId: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  platform: 'meta' | 'google';
  externalAdId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'UNKNOWN';
  creative: IAdCreative;
  metrics: IAdMetrics;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CreativeSchema = new Schema<IAdCreative>(
  {
    headline: { type: String, trim: true },
    body: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    videoUrl: { type: String, trim: true },
    callToAction: { type: String, trim: true },
    destinationUrl: { type: String, trim: true },
  },
  { _id: false }
);

const AdSchema = new Schema<IAd>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    adSetId: {
      type: Schema.Types.ObjectId,
      ref: 'AdSet',
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
    externalAdId: {
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
    creative: {
      type: CreativeSchema,
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

AdSchema.index({ clientId: 1, externalAdId: 1 });

export const Ad: Model<IAd> =
  mongoose.models.Ad || mongoose.model<IAd>('Ad', AdSchema);
