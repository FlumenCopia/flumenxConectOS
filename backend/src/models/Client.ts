import mongoose, { Document, Schema, Types } from 'mongoose';

export type ClientStatus = 'active' | 'onboarding' | 'paused' | 'inactive' | 'archived' | 'suspended';
export type ClientHealth = 'healthy' | 'needs_attention' | 'at_risk' | 'inactive';
export type OnboardingStatus = 'pending' | 'in_progress' | 'completed';
export type OnboardingItemStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'not_applicable';

export interface IOnboardingItem {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  status: OnboardingItemStatus;
  completedBy?: Types.ObjectId;
  completedAt?: Date;
  notes?: string;
  dueDate?: Date;
}

export interface IClientSettings {
  leadResponseThresholdMinutes: number;
  notificationEmails: string[];
  brandPrimaryColor?: string;
  allowClientUserInvites?: boolean;
}

export interface IClient extends Document {
  name: string;
  slug: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone: string;
  currency: string;
  logoUrl?: string;
  brandColor?: string;
  status: ClientStatus;
  health: ClientHealth;
  primaryAccountManagerId?: Types.ObjectId;
  backupAccountManagerId?: Types.ObjectId;
  onboardingStatus: OnboardingStatus;
  onboardingProgress: number;
  onboardingChecklist: IOnboardingItem[];
  settings: IClientSettings;
  notes?: string;
  isArchived: boolean;
  archivedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const defaultOnboardingChecklist: Array<{ title: string; description: string }> = [
  { title: 'Client workspace created', description: 'Initial workspace and organization profile configured' },
  { title: 'Primary contact added', description: 'Key client point-of-contact details recorded' },
  { title: 'Business profile completed', description: 'Legal name, address, timezone, and currency set' },
  { title: 'Website added', description: 'Production website URL and domains verified' },
  { title: 'Brand assets received', description: 'Logos, color codes, and brand guidelines uploaded' },
  { title: 'Google Ads access requested', description: 'MCC invite sent and account access linked' },
  { title: 'Facebook Page access requested', description: 'Meta Business Manager partnership requested' },
  { title: 'Instagram access requested', description: 'Instagram professional account linked' },
  { title: 'Facebook Lead Ads access requested', description: 'Lead generation form permissions enabled' },
  { title: 'WhatsApp Business access requested', description: 'Cloud API or WABA phone number linked' },
  { title: 'Website form requirements collected', description: 'Form fields and webhook integration endpoints defined' },
  { title: 'Tracking requirements reviewed', description: 'GA4, Google Tag Manager, and Meta Pixel verified' },
  { title: 'Reporting expectations confirmed', description: 'KPI targets, report cadence, and stakeholder emails set' },
  { title: 'Client launch approval completed', description: 'Client operations officially approved for launch' },
];

const onboardingItemSchema = new Schema<IOnboardingItem>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'blocked', 'not_applicable'],
      default: 'pending',
    },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    notes: { type: String, trim: true },
    dueDate: { type: Date },
  },
  { _id: true }
);

const clientSchema = new Schema<IClient>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    legalName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    timezone: {
      type: String,
      default: 'America/New_York',
    },
    currency: {
      type: String,
      default: 'USD',
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    brandColor: {
      type: String,
      default: '#1e40af',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'onboarding', 'paused', 'inactive', 'archived', 'suspended'],
      default: 'onboarding',
      index: true,
    },
    health: {
      type: String,
      enum: ['healthy', 'needs_attention', 'at_risk', 'inactive', 'Healthy', 'Needs Attention', 'At Risk', 'Inactive'],
      default: 'healthy',
      set: (v: string) => (v ? v.toLowerCase().replace(/\s+/g, '_') : 'healthy'),
      index: true,
    },
    primaryAccountManagerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    backupAccountManagerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    onboardingStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    onboardingProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    onboardingChecklist: {
      type: [onboardingItemSchema],
      default: () =>
        defaultOnboardingChecklist.map((item, idx) => ({
          title: item.title,
          description: item.description,
          status: idx === 0 ? 'completed' : 'pending',
          completedAt: idx === 0 ? new Date() : undefined,
        })),
    },
    settings: {
      leadResponseThresholdMinutes: {
        type: Number,
        default: 30,
      },
      notificationEmails: {
        type: [String],
        default: [],
      },
      brandPrimaryColor: {
        type: String,
        default: '#1e40af',
      },
      allowClientUserInvites: {
        type: Boolean,
        default: true,
      },
    },
    notes: {
      type: String,
      trim: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes for high performance querying
clientSchema.index({ status: 1, isArchived: 1 });
clientSchema.index({ createdAt: -1 });

export const Client = mongoose.model<IClient>('Client', clientSchema);
