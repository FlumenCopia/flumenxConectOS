import mongoose, { Document, Schema, Model } from 'mongoose';

export type LeadSource =
  | 'meta_ads'
  | 'google_ads'
  | 'organic'
  | 'manual'
  | 'webhook'
  | 'referral'
  | 'other';

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal_sent'
  | 'won'
  | 'lost'
  | 'unqualified';

export interface ILead extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  fullName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  jobTitle?: string;
  website?: string;

  source: LeadSource;
  sourceDetails?: string;
  campaignName?: string;
  campaignId?: string;
  adSetName?: string;
  adId?: string;
  landingPageUrl?: string;

  stage: LeadStage;
  leadScore: number;

  assignedTo?: mongoose.Types.ObjectId;
  estimatedValue?: number;
  currency: string;

  tags: string[];
  customFields: Record<string, unknown>;

  lastContactedAt?: Date;
  nextFollowUpAt?: Date;
  lostReason?: string;

  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;

  isArchived: boolean;
  archivedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    jobTitle: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    website: {
      type: String,
      trim: true,
      maxlength: 255,
    },

    source: {
      type: String,
      enum: ['meta_ads', 'google_ads', 'organic', 'manual', 'webhook', 'referral', 'other'],
      default: 'manual',
    },
    sourceDetails: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    campaignName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    campaignId: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    adSetName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    adId: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    landingPageUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    stage: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'unqualified'],
      default: 'new',
    },
    leadScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    estimatedValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      maxlength: 10,
    },

    tags: {
      type: [String],
      default: [],
    },
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
      default: () => new Map(),
    },

    lastContactedAt: {
      type: Date,
    },
    nextFollowUpAt: {
      type: Date,
    },
    lostReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound and Single Indexes for query performance and isolation
LeadSchema.index({ clientId: 1, createdAt: -1 });
LeadSchema.index({ clientId: 1, stage: 1 });
LeadSchema.index({ clientId: 1, email: 1 });
LeadSchema.index({ clientId: 1, assignedTo: 1 });
LeadSchema.index({ clientId: 1, nextFollowUpAt: 1 });
LeadSchema.index({ source: 1 });
LeadSchema.index({ fullName: 'text', email: 'text', phone: 'text', companyName: 'text' });

export const Lead: Model<ILead> = mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
