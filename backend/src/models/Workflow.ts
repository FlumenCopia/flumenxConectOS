import mongoose, { Document, Schema } from 'mongoose';

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';
export type WorkflowExecutionMode = 'immediate' | 'async';
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'greater_than'
  | 'less_than'
  | 'in_list'
  | 'exists';

export interface IWorkflowCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
  logicalOperator?: 'and' | 'or';
}

export type WorkflowActionType =
  | 'create_task'
  | 'assign_task'
  | 'update_lead_stage'
  | 'add_crm_note'
  | 'add_tag'
  | 'create_notification'
  | 'send_email'
  | 'schedule_follow_up'
  | 'pause_workflow';

export interface IWorkflowAction {
  id: string;
  type: WorkflowActionType;
  payload: Record<string, any>;
  order: number;
}

export interface IWorkflowTrigger {
  eventType: string;
  filters?: Record<string, any>;
}

export interface IWorkflow extends Document {
  clientId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  status: WorkflowStatus;
  trigger: IWorkflowTrigger;
  conditions: IWorkflowCondition[];
  actions: IWorkflowAction[];
  executionMode: WorkflowExecutionMode;
  maxExecutionsPerHour: number;
  executionHourBucket?: string;
  hourlyExecutionCount?: number;
  lastExecutedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowConditionSchema = new Schema<IWorkflowCondition>(
  {
    field: { type: String, required: true, trim: true },
    operator: {
      type: String,
      required: true,
      enum: [
        'equals',
        'not_equals',
        'contains',
        'starts_with',
        'greater_than',
        'less_than',
        'in_list',
        'exists',
      ],
    },
    value: { type: Schema.Types.Mixed },
    logicalOperator: { type: String, enum: ['and', 'or'], default: 'and' },
  },
  { _id: false }
);

const WorkflowActionSchema = new Schema<IWorkflowAction>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'create_task',
        'assign_task',
        'update_lead_stage',
        'add_crm_note',
        'add_tag',
        'create_notification',
        'send_email',
        'schedule_follow_up',
        'pause_workflow',
      ],
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const WorkflowTriggerSchema = new Schema<IWorkflowTrigger>(
  {
    eventType: { type: String, required: true, trim: true },
    filters: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const WorkflowSchema = new Schema<IWorkflow>(
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
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'archived'],
      default: 'draft',
      index: true,
    },
    trigger: {
      type: WorkflowTriggerSchema,
      required: true,
    },
    conditions: {
      type: [WorkflowConditionSchema],
      default: [],
    },
    actions: {
      type: [WorkflowActionSchema],
      default: [],
    },
    executionMode: {
      type: String,
      enum: ['immediate', 'async'],
      default: 'immediate',
    },
    maxExecutionsPerHour: {
      type: Number,
      default: 100,
      min: 1,
      max: 1000,
    },
    executionHourBucket: {
      type: String,
      default: '',
    },
    hourlyExecutionCount: {
      type: Number,
      default: 0,
    },
    lastExecutedAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for tenant isolation and trigger matching
WorkflowSchema.index({ clientId: 1, status: 1 });
WorkflowSchema.index({ clientId: 1, 'trigger.eventType': 1, status: 1 });
WorkflowSchema.index({ clientId: 1, createdAt: -1 });

export const Workflow = mongoose.model<IWorkflow>('Workflow', WorkflowSchema);
