import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISlaPolicy extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  name: string;
  isDefault: boolean;
  urgentTargetMinutes: number; // default: 15 mins
  highTargetMinutes: number;   // default: 60 mins (1 hr)
  normalTargetMinutes: number; // default: 240 mins (4 hrs)
  lowTargetMinutes: number;    // default: 1440 mins (24 hrs / 1 business day)
  businessHoursOnly: boolean;
  escalationEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SlaPolicySchema = new Schema<ISlaPolicy>(
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
      default: 'Standard Response SLA',
    },
    isDefault: {
      type: Boolean,
      default: true,
      index: true,
    },
    urgentTargetMinutes: {
      type: Number,
      default: 15,
      min: 1,
    },
    highTargetMinutes: {
      type: Number,
      default: 60,
      min: 1,
    },
    normalTargetMinutes: {
      type: Number,
      default: 240,
      min: 1,
    },
    lowTargetMinutes: {
      type: Number,
      default: 1440,
      min: 1,
    },
    businessHoursOnly: {
      type: Boolean,
      default: false,
    },
    escalationEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  }
);

SlaPolicySchema.index({ clientId: 1, isDefault: 1 });

export const SlaPolicy: Model<ISlaPolicy> =
  mongoose.models.SlaPolicy || mongoose.model<ISlaPolicy>('SlaPolicy', SlaPolicySchema);
