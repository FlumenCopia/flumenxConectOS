import { z } from 'zod';

export const createConnectionSchema = z.object({
  platform: z.enum(['meta', 'google']),
  accountName: z.string().min(1, 'Account name is required').max(200),
  accountId: z.string().min(1, 'Account ID is required').max(100),
  accessToken: z.string().min(10, 'Access token must be at least 10 characters'),
  refreshToken: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

export const updateConnectionStatusSchema = z.object({
  status: z.enum(['active', 'expired', 'revoked', 'error']),
});

export const adReportingFilterSchema = z.object({
  platform: z.enum(['meta', 'google', 'all']).optional().default('all'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
  campaignId: z.string().optional(),
});

export const adAttributionFilterSchema = z.object({
  leadId: z.string().optional(),
  platform: z.enum(['meta', 'google', 'organic', 'direct', 'referral', 'other', 'all']).optional(),
  touchType: z.enum(['first_touch', 'last_touch', 'multi_touch', 'all']).optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(25),
});
