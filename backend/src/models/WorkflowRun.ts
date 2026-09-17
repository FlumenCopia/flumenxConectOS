import mongoose, { Document, Schema } from 'mongoose';

export type WorkflowRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';

export interface IActionResult {
  actionId: string;
  actionType: string;
  status: 'success' | 'failed' | 'skipped';
  output?: any;
  error?: string;
  executedAt: Date;
  durationMs: number;
}

export interface IWorkflowRun extends Document {
  clientId: mongoose.Types.ObjectId;
  workflowId: mongoose.Types.ObjectId;
  eventType: string;
  eventId: string;
  status: WorkflowRunStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  actionResults: IActionResult[];
  idempotencyKey: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ActionResultSchema = new Schema<IActionResult>(
  {
    actionId: { type: String, required: true },
    actionType: { type: String, required: true },
    status: { type: String, enum: ['success', 'failed', 'skipped'], required: true },
    output: { type: Schema.Types.Mixed },
    error: { type: String },
    executedAt: { type: Date, default: Date.now },
    durationMs: { type: Number, default: 0 },
  },
  { _id: false }
);

const WorkflowRunSchema = new Schema<IWorkflowRun>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'skipped'],
      default: 'queued',
      index: true,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    error: {
      type: String,
    },
    actionResults: {
      type: [ActionResultSchema],
      default: [],
    },
    idempotencyKey: {
      type: String,
      required: true,
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

// Consistent, strict unique idempotency indexes per tenant, workflow, and event
WorkflowRunSchema.index({ clientId: 1, idempotencyKey: 1 }, { unique: true });
WorkflowRunSchema.index({ clientId: 1, workflowId: 1, eventId: 1 }, { unique: true });
WorkflowRunSchema.index({ workflowId: 1, createdAt: -1 });
WorkflowRunSchema.index({ clientId: 1, createdAt: -1 });
WorkflowRunSchema.index({ clientId: 1, status: 1 });

export const WorkflowRun = mongoose.model<IWorkflowRun>('WorkflowRun', WorkflowRunSchema);
