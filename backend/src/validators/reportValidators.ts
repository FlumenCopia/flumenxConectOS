import { z } from 'zod';

export const dateRangePresetEnum = z.enum([
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'this_month',
  'previous_month',
  'custom',
]);

export const reportFilterSchema = z.object({
  preset: dateRangePresetEnum.optional().default('last_30_days'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  compare: z.coerce.boolean().optional().default(true),
  source: z.string().optional(),
  campaignId: z.string().optional(),
  stage: z.string().optional(),
  taskStatus: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().optional(),
  formId: z.string().optional(),
  channel: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(50),
}).refine(
  (data) => {
    if (data.preset === 'custom') {
      if (!data.startDate || !data.endDate) return false;
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: 'Custom date range requires valid startDate and endDate where startDate <= endDate',
    path: ['startDate'],
  }
).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      const diffDays = (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 366; // Maximum 1 year range protection
    }
    return true;
  },
  {
    message: 'Date range cannot exceed 366 days (1 year)',
    path: ['endDate'],
  }
);

export const exportReportSchema = z.object({
  reportType: z.enum(['overview', 'leads', 'campaigns', 'forms', 'tasks', 'team', 'conversations']),
  preset: dateRangePresetEnum.optional().default('last_30_days'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  source: z.string().optional(),
  campaignId: z.string().optional(),
  stage: z.string().optional(),
  taskStatus: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().optional(),
  formId: z.string().optional(),
  channel: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(1000),
});

export const createSavedReportSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  reportType: z.enum(['overview', 'leads', 'campaigns', 'forms', 'tasks', 'team', 'conversations', 'custom']),
  filters: z.record(z.any()).optional().default({}),
  dateRange: z
    .object({
      preset: dateRangePresetEnum.optional().default('last_30_days'),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .optional()
    .default({ preset: 'last_30_days' }),
  visibility: z.enum(['private', 'workspace']).optional().default('workspace'),
});

export const updateSavedReportSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  reportType: z.enum(['overview', 'leads', 'campaigns', 'forms', 'tasks', 'team', 'conversations', 'custom']).optional(),
  filters: z.record(z.any()).optional(),
  dateRange: z
    .object({
      preset: dateRangePresetEnum.optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .optional(),
  visibility: z.enum(['private', 'workspace']).optional(),
});
