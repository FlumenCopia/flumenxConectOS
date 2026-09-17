import mongoose, { Document, Schema, Model } from 'mongoose';

export type ReportType =
  | 'overview'
  | 'leads'
  | 'campaigns'
  | 'forms'
  | 'tasks'
  | 'team'
  | 'conversations'
  | 'custom';

export interface IReportSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  reportType: ReportType;
  dateRange: {
    startDate: Date;
    endDate: Date;
    preset?: string;
  };
  filters: Record<string, any>;
  metrics: Record<string, any>;
  generatedAt: Date;
  expiresAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSnapshotSchema = new Schema<IReportSnapshot>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    reportType: {
      type: String,
      enum: ['overview', 'leads', 'campaigns', 'forms', 'tasks', 'team', 'conversations', 'custom'],
      required: true,
      index: true,
    },
    dateRange: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      preset: { type: String },
    },
    filters: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metrics: {
      type: Schema.Types.Mixed,
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

// Compound tenant index
ReportSnapshotSchema.index({ clientId: 1, reportType: 1, generatedAt: -1 });

export const ReportSnapshot: Model<IReportSnapshot> =
  mongoose.models.ReportSnapshot || mongoose.model<IReportSnapshot>('ReportSnapshot', ReportSnapshotSchema);
