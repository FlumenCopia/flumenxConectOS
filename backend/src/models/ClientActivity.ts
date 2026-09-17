import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IClientActivity extends Document {
  clientId: Types.ObjectId;
  userId?: Types.ObjectId;
  userEmail?: string;
  userName?: string;
  action: string;
  title: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

const clientActivitySchema = new Schema<IClientActivity>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    userEmail: {
      type: String,
      trim: true,
    },
    userName: {
      type: String,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// Indexes
clientActivitySchema.index({ clientId: 1, createdAt: -1 });

export const ClientActivity = mongoose.model<IClientActivity>(
  'ClientActivity',
  clientActivitySchema
);
