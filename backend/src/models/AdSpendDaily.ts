import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAdSpendDaily extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  platform: 'meta' | 'google';
  campaignId?: mongoose.Types.ObjectId;
  externalCampaignId: string;
  adSetId?: mongoose.Types.ObjectId;
  externalAdSetId?: string;
  adId?: mongoose.Types.ObjectId;
  externalAdId?: string;
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdSpendDailySchema = new Schema<IAdSpendDaily>(
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
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'AdCampaign',
      index: true,
    },
    externalCampaignId: {
      type: String,
      required: true,
      index: true,
    },
    adSetId: {
      type: Schema.Types.ObjectId,
      ref: 'AdSet',
    },
    externalAdSetId: {
      type: String,
    },
    adId: {
      type: Schema.Types.ObjectId,
      ref: 'Ad',
    },
    externalAdId: {
      type: String,
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    spend: {
      type: Number,
      default: 0,
      min: 0,
    },
    impressions: {
      type: Number,
      default: 0,
      min: 0,
    },
    clicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    conversions: {
      type: Number,
      default: 0,
      min: 0,
    },
    leads: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
  },
  {
    timestamps: true,
  }
);

AdSpendDailySchema.index({ clientId: 1, date: 1 });
AdSpendDailySchema.index({ clientId: 1, platform: 1, date: -1 });
AdSpendDailySchema.index({ clientId: 1, externalCampaignId: 1, date: 1 });

export const AdSpendDaily: Model<IAdSpendDaily> =
  mongoose.models.AdSpendDaily ||
  mongoose.model<IAdSpendDaily>('AdSpendDaily', AdSpendDailySchema);
