import { z } from 'zod';

const conditionOperatorEnum = z.enum([
  'equals',
  'not_equals',
  'contains',
  'starts_with',
  'greater_than',
  'less_than',
  'in_list',
  'exists',
]);

const triggerEventTypeEnum = z.enum([
  'lead.created',
  'lead.updated',
  'lead.stage_changed',
  'form.submitted',
  'task.created',
  'task.overdue',
  'task.sla_breached',
  'task.completed',
  'conversation.received',
  'conversation.replied',
  'manual.trigger',
]);

const actionTypeEnum = z.enum([
  'create_task',
  'assign_task',
  'update_lead_stage',
  'add_crm_note',
  'add_tag',
  'create_notification',
  'send_email',
  'schedule_follow_up',
  'pause_workflow',
]);

const conditionSchema = z.object({
  field: z
    .string()
    .min(1, 'Condition field is required')
    .max(100, 'Condition field path too long')
    .refine((f) => !f.includes('__proto__') && !f.includes('constructor'), {
      message: 'Unsafe property traversal detected',
    }),
  operator: conditionOperatorEnum,
  value: z.any().optional(),
  logicalOperator: z.enum(['and', 'or']).optional().default('and'),
});

const actionSchema = z.object({
  id: z.string().optional(),
  type: actionTypeEnum,
  payload: z.record(z.any()).default({}),
  order: z.number().int().min(0).optional().default(0),
});

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(1, 'Workflow name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().trim().max(500, 'Description must be at most 500 characters').optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional().default('draft'),
  trigger: z.object({
    eventType: triggerEventTypeEnum,
    filters: z.record(z.any()).optional().default({}),
  }),
  conditions: z.array(conditionSchema).max(10, 'A workflow cannot have more than 10 conditions').optional().default([]),
  actions: z
    .array(actionSchema)
    .min(1, 'At least one action is required')
    .max(10, 'A workflow cannot have more than 10 actions'),
  executionMode: z.enum(['immediate', 'async']).optional().default('immediate'),
  maxExecutionsPerHour: z.number().int().min(1).max(1000).optional().default(100),
});

export const updateWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  trigger: z
    .object({
      eventType: triggerEventTypeEnum,
      filters: z.record(z.any()).optional(),
    })
    .optional(),
  conditions: z.array(conditionSchema).max(10).optional(),
  actions: z.array(actionSchema).min(1).max(10).optional(),
  executionMode: z.enum(['immediate', 'async']).optional(),
  maxExecutionsPerHour: z.number().int().min(1).max(1000).optional(),
});

export const updateWorkflowStatusSchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'archived']),
});

export const testWorkflowConditionsSchema = z.object({
  payload: z.record(z.any()),
});

export const executeManualWorkflowSchema = z.object({
  payload: z.record(z.any()).optional().default({}),
  eventId: z.string().trim().optional(),
});
