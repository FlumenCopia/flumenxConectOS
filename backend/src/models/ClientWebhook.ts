import mongoose, { Document, Schema, Model } from 'mongoose';

export type WebhookStatus = 'active' | 'revoked' | 'suspended';

export interface IClientWebhook extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  name: string;
  keyId: string;
  secretHash: string;
  status: WebhookStatus;
  allowedSources: string[];
  lastUsedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ClientWebhookSchema = new Schema<IClientWebhook>(
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
      maxlength: 100,
    },
    keyId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    secretHash: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: ['active', 'revoked', 'suspended'],
      default: 'active',
      index: true,
    },
    allowedSources: {
      type: [String],
      default: ['webhook', 'meta_ads', 'google_ads', 'organic', 'manual'],
    },
    lastUsedAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        delete ret.__v;
        delete ret.secretHash;
        return ret;
      },
    },
  }
);

ClientWebhookSchema.index({ clientId: 1, status: 1 });

export const ClientWebhook: Model<IClientWebhook> =
  mongoose.models.ClientWebhook || mongoose.model<IClientWebhook>('ClientWebhook', ClientWebhookSchema);
