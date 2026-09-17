import mongoose, { Document, Schema, Model } from 'mongoose';

export type LeadActivityType =
  | 'created'
  | 'updated'
  | 'stage_changed'
  | 'assigned'
  | 'note_added'
  | 'contact_attempt'
  | 'follow_up_scheduled'
  | 'score_changed'
  | 'webhook_received'
  | 'archived';

export interface ILeadActivity extends Document {
  _id: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  activityType: LeadActivityType;
  description: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const LeadActivitySchema = new Schema<ILeadActivity>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
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
    activityType: {
      type: String,
      enum: [
        'created',
        'updated',
        'stage_changed',
        'assigned',
        'note_added',
        'contact_attempt',
        'follow_up_scheduled',
        'score_changed',
        'webhook_received',
        'archived',
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: () => new Map(),
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

LeadActivitySchema.index({ leadId: 1, createdAt: -1 });
LeadActivitySchema.index({ clientId: 1, createdAt: -1 });
LeadActivitySchema.index({ activityType: 1 });

export const LeadActivity: Model<ILeadActivity> =
  mongoose.models.LeadActivity || mongoose.model<ILeadActivity>('LeadActivity', LeadActivitySchema);
