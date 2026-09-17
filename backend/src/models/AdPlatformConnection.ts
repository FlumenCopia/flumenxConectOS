import mongoose, { Document, Schema, Model } from 'mongoose';

export type AdPlatformType = 'meta' | 'google';
export type ConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';
export type SyncStatus = 'success' | 'partial' | 'failed';

export interface IAdPlatformConnection extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  platform: AdPlatformType;
  accountName: string;
  accountId: string;
  status: ConnectionStatus;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  tokenExpiresAt?: Date;
  lastSyncAt?: Date;
  lastSyncStatus?: SyncStatus;
  lastSyncError?: string;
  metadata: Record<string, any>;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AdPlatformConnectionSchema = new Schema<IAdPlatformConnection>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['meta', 'google'],
      required: true,
      index: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    accountId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked', 'error'],
      default: 'active',
      index: true,
    },
    encryptedAccessToken: {
      type: String,
      required: true,
      select: false, // Never return in default queries
    },
    encryptedRefreshToken: {
      type: String,
      select: false,
    },
    tokenExpiresAt: {
      type: Date,
    },
    lastSyncAt: {
      type: Date,
    },
    lastSyncStatus: {
      type: String,
      enum: ['success', 'partial', 'failed'],
    },
    lastSyncError: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
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

AdPlatformConnectionSchema.index({ clientId: 1, platform: 1 });
AdPlatformConnectionSchema.index({ clientId: 1, status: 1 });

export const AdPlatformConnection: Model<IAdPlatformConnection> =
  mongoose.models.AdPlatformConnection ||
  mongoose.model<IAdPlatformConnection>('AdPlatformConnection', AdPlatformConnectionSchema);
