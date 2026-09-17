import mongoose, { Document, Schema, Model } from 'mongoose';

export type ProviderType = 'mock' | 'resend' | 'twilio' | 'whatsapp' | 'meta_instagram' | 'meta_messenger' | 'custom_webhook';
export type ProviderStatus = 'active' | 'inactive' | 'error';

export interface ICommunicationProvider extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  providerType: ProviderType;
  displayName: string;
  status: ProviderStatus;
  configuration: Record<string, any>;
  isDefault: boolean;
  webhookSecretHash?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CommunicationProviderSchema = new Schema<ICommunicationProvider>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    providerType: {
      type: String,
      enum: ['mock', 'resend', 'twilio', 'whatsapp', 'meta_instagram', 'meta_messenger', 'custom_webhook'],
      required: true,
      default: 'mock',
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'error'],
      default: 'active',
      index: true,
    },
    configuration: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    webhookSecretHash: {
      type: String,
      select: false, // Protected from accidental query leakage
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

CommunicationProviderSchema.index({ clientId: 1, providerType: 1, status: 1 });
CommunicationProviderSchema.index({ clientId: 1, isDefault: 1 });

export const CommunicationProvider: Model<ICommunicationProvider> =
  mongoose.models.CommunicationProvider ||
  mongoose.model<ICommunicationProvider>('CommunicationProvider', CommunicationProviderSchema);
