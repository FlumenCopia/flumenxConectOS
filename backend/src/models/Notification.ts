import mongoose, { Document, Schema } from 'mongoose';

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';
export type NotificationSourceType =
  | 'lead'
  | 'task'
  | 'conversation'
  | 'workflow_run'
  | 'form_submission'
  | 'system';

export interface INotification extends Document {
  clientId: mongoose.Types.ObjectId;
  recipientUserId: mongoose.Types.ObjectId;
  recipientType: 'user' | 'portal_user';
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  readAt?: Date | null;
  sourceType?: NotificationSourceType;
  sourceId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    recipientType: {
      type: String,
      enum: ['user', 'portal_user'],
      default: 'user',
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      default: 'workflow_alert',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info',
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['lead', 'task', 'conversation', 'workflow_run', 'form_submission', 'system'],
      default: 'system',
    },
    sourceId: {
      type: String,
      trim: true,
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

// High performance indexes for unread lookups and notifications feeds
NotificationSchema.index({ clientId: 1, recipientUserId: 1, readAt: 1 });
NotificationSchema.index({ recipientUserId: 1, createdAt: -1 });
NotificationSchema.index({ clientId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
