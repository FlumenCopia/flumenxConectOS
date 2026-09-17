import mongoose, { Document, Schema, Model } from 'mongoose';

export type FormStatus = 'draft' | 'published' | 'paused' | 'archived';

export interface INotificationSettings {
  emailRecipients: string[];
  notifyOnSubmission: boolean;
}

export interface ICaptchaSettings {
  enabled: boolean;
  provider: 'mock' | 'recaptcha_v3' | 'hcaptcha';
  siteKey?: string;
}

export interface IWebsiteForm extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  publicKey: string;
  status: FormStatus;
  submitButtonLabel: string;
  successMessage: string;
  redirectUrl?: string;
  allowedDomains: string[];
  notificationSettings: INotificationSettings;
  captchaSettings: ICaptchaSettings;
  honeypotField: string;
  submissionsCount: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WebsiteFormSchema = new Schema<IWebsiteForm>(
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
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    publicKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'paused', 'archived'],
      default: 'draft',
      index: true,
    },
    submitButtonLabel: {
      type: String,
      default: 'Submit',
      trim: true,
      maxlength: 100,
    },
    successMessage: {
      type: String,
      default: 'Thank you! Your submission has been received.',
      trim: true,
      maxlength: 1000,
    },
    redirectUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
    },
    allowedDomains: {
      type: [String],
      default: [],
    },
    notificationSettings: {
      emailRecipients: { type: [String], default: [] },
      notifyOnSubmission: { type: Boolean, default: true },
    },
    captchaSettings: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, enum: ['mock', 'recaptcha_v3', 'hcaptcha'], default: 'mock' },
      siteKey: { type: String, trim: true },
    },
    honeypotField: {
      type: String,
      default: '_hp_website',
      trim: true,
    },
    submissionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

WebsiteFormSchema.index({ clientId: 1, createdAt: -1 });
WebsiteFormSchema.index({ clientId: 1, status: 1 });

export const WebsiteForm: Model<IWebsiteForm> =
  mongoose.models.WebsiteForm ||
  mongoose.model<IWebsiteForm>('WebsiteForm', WebsiteFormSchema);
