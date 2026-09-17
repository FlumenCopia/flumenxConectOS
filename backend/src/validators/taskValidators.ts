import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(250),
  description: z.string().max(2000).optional(),
  taskType: z.enum(['call', 'email', 'meeting', 'follow_up', 'review', 'other']).optional().default('follow_up'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  dueAt: z.coerce.date({ required_error: 'Due date is required' }),
  assignedTo: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  conversationId: z.string().optional(),
  formSubmissionId: z.string().optional(),
  campaignId: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(250).optional(),
  description: z.string().max(2000).optional(),
  taskType: z.enum(['call', 'email', 'meeting', 'follow_up', 'review', 'other']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  dueAt: z.coerce.date().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled', 'snoozed']).optional(),
  completionNotes: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

export const assignTaskSchema = z.object({
  assignedTo: z.string().nullable().optional(),
  reason: z.string().max(500).optional(),
});

export const updatePrioritySchema = z.object({
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  reason: z.string().max(500).optional(),
});

export const updateDueDateSchema = z.object({
  dueAt: z.coerce.date({ required_error: 'Due date is required' }),
  reason: z.string().max(500).optional(),
});

export const snoozeTaskSchema = z.object({
  snoozedUntil: z.coerce.date({ required_error: 'Snooze until date is required' }),
  reason: z.string().max(500).optional(),
});

export const completeTaskSchema = z.object({
  completionNotes: z.string().max(2000).optional(),
});

export const applyDispositionSchema = z.object({
  disposition: z.string().min(1, 'Disposition code is required'),
  notes: z.string().max(2000).optional(),
  scheduleFollowUp: z.boolean().optional().default(false),
  followUpDueAt: z.coerce.date().optional(),
  followUpTitle: z.string().max(250).optional(),
  followUpType: z.enum(['call', 'email', 'meeting', 'follow_up', 'review', 'other']).optional(),
  updateLeadStage: z.string().optional(),
});

export const slaPolicySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  urgentTargetMinutes: z.number().int().min(1).optional(),
  highTargetMinutes: z.number().int().min(1).optional(),
  normalTargetMinutes: z.number().int().min(1).optional(),
  lowTargetMinutes: z.number().int().min(1).optional(),
  businessHoursOnly: z.boolean().optional(),
  escalationEmail: z.string().email().optional().or(z.literal('')),
});

export const taskFilterSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  taskType: z.string().optional(),
  assignedTo: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  conversationId: z.string().optional(),
  slaBreached: z.enum(['true', 'false']).optional(),
  dueFrom: z.string().optional(),
  dueTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
});
