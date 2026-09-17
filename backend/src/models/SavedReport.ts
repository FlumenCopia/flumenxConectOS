import mongoose, { Document, Schema, Model } from 'mongoose';
import { ReportType } from './ReportSnapshot';

export type ReportVisibility = 'private' | 'workspace';

export interface ISavedReport extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  reportType: ReportType;
  filters: Record<string, any>;
  dateRange: {
    preset?: string;
    startDate?: Date;
    endDate?: Date;
  };
  visibility: ReportVisibility;
  createdBy: mongoose.Types.ObjectId;
  lastRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SavedReportSchema = new Schema<ISavedReport>(
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
    reportType: {
      type: String,
      enum: ['overview', 'leads', 'campaigns', 'forms', 'tasks', 'team', 'conversations', 'custom'],
      required: true,
      default: 'overview',
      index: true,
    },
    filters: {
      type: Schema.Types.Mixed,
      default: {},
    },
    dateRange: {
      preset: { type: String, default: 'last_30_days' },
      startDate: { type: Date },
      endDate: { type: Date },
    },
    visibility: {
      type: String,
      enum: ['private', 'workspace'],
      default: 'workspace',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lastRunAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound tenant indexes
SavedReportSchema.index({ clientId: 1, visibility: 1, createdAt: -1 });
SavedReportSchema.index({ clientId: 1, createdBy: 1 });

export const SavedReport: Model<ISavedReport> =
  mongoose.models.SavedReport || mongoose.model<ISavedReport>('SavedReport', SavedReportSchema);
