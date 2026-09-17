import mongoose, { Document, Schema, Model } from 'mongoose';

export type TouchType = 'first_touch' | 'last_touch' | 'multi_touch';
export type AttributionPlatform =
  | 'meta'
  | 'google'
  | 'organic'
  | 'direct'
  | 'referral'
  | 'other';
export type AttributionSourceType =
  | 'utm'
  | 'click_id'
  | 'form_metadata'
  | 'manual'
  | 'webhook';

export interface ILeadAttribution extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  contactId?: mongoose.Types.ObjectId;
  formSubmissionId?: mongoose.Types.ObjectId;
  touchType: TouchType;
  platform: AttributionPlatform;
  campaignId?: mongoose.Types.ObjectId;
  externalCampaignId?: string;
  campaignName?: string;
  adSetId?: mongoose.Types.ObjectId;
  externalAdSetId?: string;
  adSetName?: string;
  adId?: mongoose.Types.ObjectId;
  externalAdId?: string;
  adName?: string;
  clickId?: string; // fbclid, gclid, etc.
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPageUrl?: string;
  referrer?: string;
  timestamp: Date;
  confidence: number;
  attributionSource: AttributionSourceType;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const LeadAttributionSchema = new Schema<ILeadAttribution>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      index: true,
    },
    formSubmissionId: {
      type: Schema.Types.ObjectId,
      ref: 'FormSubmission',
      index: true,
    },
    touchType: {
      type: String,
      enum: ['first_touch', 'last_touch', 'multi_touch'],
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['meta', 'google', 'organic', 'direct', 'referral', 'other'],
      required: true,
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'AdCampaign',
    },
    externalCampaignId: {
      type: String,
      trim: true,
    },
    campaignName: {
      type: String,
      trim: true,
    },
    adSetId: {
      type: Schema.Types.ObjectId,
      ref: 'AdSet',
    },
    externalAdSetId: {
      type: String,
      trim: true,
    },
    adSetName: {
      type: String,
      trim: true,
    },
    adId: {
      type: Schema.Types.ObjectId,
      ref: 'Ad',
    },
    externalAdId: {
      type: String,
      trim: true,
    },
    adName: {
      type: String,
      trim: true,
    },
    clickId: {
      type: String,
      trim: true,
      index: true,
    },
    utmSource: {
      type: String,
      trim: true,
      lowercase: true,
    },
    utmMedium: {
      type: String,
      trim: true,
      lowercase: true,
    },
    utmCampaign: {
      type: String,
      trim: true,
    },
    utmTerm: {
      type: String,
      trim: true,
    },
    utmContent: {
      type: String,
      trim: true,
    },
    landingPageUrl: {
      type: String,
      trim: true,
    },
    referrer: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    confidence: {
      type: Number,
      default: 1.0,
      min: 0,
      max: 1,
    },
    attributionSource: {
      type: String,
      enum: ['utm', 'click_id', 'form_metadata', 'manual', 'webhook'],
      default: 'utm',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

LeadAttributionSchema.index({ clientId: 1, leadId: 1 });
LeadAttributionSchema.index({ clientId: 1, touchType: 1 });
LeadAttributionSchema.index({ clientId: 1, platform: 1 });

export const LeadAttribution: Model<ILeadAttribution> =
  mongoose.models.LeadAttribution ||
  mongoose.model<ILeadAttribution>('LeadAttribution', LeadAttributionSchema);
