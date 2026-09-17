import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IPortalCommunicationPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  marketing: boolean;
}

export interface IPortalUser extends Document {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  contactId: Types.ObjectId;
  leadId?: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  passwordHash: string;
  status: 'active' | 'inactive' | 'suspended';
  tokenVersion: number;
  communicationPreferences: IPortalCommunicationPreferences;
  consentGiven: boolean;
  consentGivenAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const PortalUserSchema = new Schema<IPortalUser>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 150,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
      index: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      required: true,
    },
    communicationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false },
    },
    consentGiven: {
      type: Boolean,
      default: true,
    },
    consentGivenAt: {
      type: Date,
      default: Date.now,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
    },
    lastLoginAt: {
      type: Date,
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

// Unique compound indexes: One active portal user per client+email and client+contact
PortalUserSchema.index({ clientId: 1, email: 1 }, { unique: true });
PortalUserSchema.index({ clientId: 1, contactId: 1 }, { unique: true });
PortalUserSchema.index({ clientId: 1, status: 1 });

PortalUserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const PortalUser = mongoose.model<IPortalUser>('PortalUser', PortalUserSchema);
