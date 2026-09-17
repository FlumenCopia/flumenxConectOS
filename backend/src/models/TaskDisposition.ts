import mongoose, { Document, Schema, Model } from 'mongoose';

export type DispositionCategory = 'positive' | 'neutral' | 'negative' | 'followup_required';

export interface ITaskDisposition extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  code: string;
  label: string;
  category: DispositionCategory;
  requiresFollowup: boolean;
  isSystem: boolean;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const TaskDispositionSchema = new Schema<ITaskDisposition>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['positive', 'neutral', 'negative', 'followup_required'],
      default: 'neutral',
      index: true,
    },
    requiresFollowup: {
      type: Boolean,
      default: false,
    },
    isSystem: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

TaskDispositionSchema.index({ clientId: 1, code: 1 }, { unique: true });
TaskDispositionSchema.index({ clientId: 1, order: 1 });

export const TaskDisposition: Model<ITaskDisposition> =
  mongoose.models.TaskDisposition ||
  mongoose.model<ITaskDisposition>('TaskDisposition', TaskDispositionSchema);
