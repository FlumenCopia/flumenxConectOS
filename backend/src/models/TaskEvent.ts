import mongoose, { Document, Schema, Model } from 'mongoose';

export type TaskEventType =
  | 'created'
  | 'assigned'
  | 'reassigned'
  | 'priority_changed'
  | 'due_date_changed'
  | 'status_changed'
  | 'snoozed'
  | 'disposition_applied'
  | 'sla_breached'
  | 'completed'
  | 'cancelled'
  | 'comment'
  | 'customer_comment';

export interface ITaskEvent extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  eventType: TaskEventType;
  description: string;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  actorId?: mongoose.Types.ObjectId;
  actorName?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

const TaskEventSchema = new Schema<ITaskEvent>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'created',
        'assigned',
        'reassigned',
        'priority_changed',
        'due_date_changed',
        'status_changed',
        'snoozed',
        'disposition_applied',
        'sla_breached',
        'completed',
        'cancelled',
        'comment',
        'customer_comment',
      ],
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    previousValue: {
      type: Schema.Types.Mixed,
    },
    newValue: {
      type: Schema.Types.Mixed,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    actorName: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

TaskEventSchema.index({ clientId: 1, taskId: 1, createdAt: -1 });

export const TaskEvent: Model<ITaskEvent> =
  mongoose.models.TaskEvent || mongoose.model<ITaskEvent>('TaskEvent', TaskEventSchema);
