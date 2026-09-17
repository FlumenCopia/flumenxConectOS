import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId format',
});

export const leadSourceEnum = z.enum([
  'meta_ads',
  'google_ads',
  'organic',
  'manual',
  'webhook',
  'referral',
  'other',
]);

export const leadStageEnum = z.enum([
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'won',
  'lost',
  'unqualified',
]);

export const createLeadSchema = z
  .object({
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    fullName: z.string().trim().max(200).optional(),
    email: z.string().trim().email('Invalid email address format').optional().or(z.literal('')),
    phone: z.string().trim().max(50).optional().or(z.literal('')),
    companyName: z.string().trim().max(150).optional(),
    jobTitle: z.string().trim().max(100).optional(),
    website: z.string().trim().url('Invalid website URL format').optional().or(z.literal('')),

    source: leadSourceEnum.default('manual'),
    sourceDetails: z.string().trim().max(500).optional(),
    campaignName: z.string().trim().max(200).optional(),
    campaignId: z.string().trim().max(100).optional(),
    adSetName: z.string().trim().max(200).optional(),
    adId: z.string().trim().max(100).optional(),
    landingPageUrl: z.string().trim().max(500).optional(),

    stage: leadStageEnum.default('new'),
    leadScore: z.number().min(0).max(100).default(50),

    assignedTo: objectIdSchema.optional().nullable(),
    estimatedValue: z.number().min(0).default(0),
    currency: z.string().trim().max(10).default('USD'),

    tags: z.array(z.string().trim().max(50)).default([]),
    customFields: z.record(z.unknown()).default({}),

    nextFollowUpAt: z.string().datetime({ offset: true }).optional().nullable().or(z.date().optional()),
    notes: z.string().trim().max(2000).optional(),
    clientId: objectIdSchema.optional(), // Only applicable for Super Admin; client users are strictly bound
  })
  .refine(
    (data) => {
      return (
        (data.fullName && data.fullName.trim().length > 0) ||
        (data.firstName && data.firstName.trim().length > 0) ||
        (data.email && data.email.trim().length > 0) ||
        (data.phone && data.phone.trim().length > 0)
      );
    },
    {
      message: 'At least one contact identifier (Full Name, First Name, Email, or Phone) is required.',
      path: ['fullName'],
    }
  );

export const updateLeadSchema = z.object({
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  fullName: z.string().trim().max(200).optional(),
  email: z.string().trim().email('Invalid email address format').optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  companyName: z.string().trim().max(150).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  website: z.string().trim().url('Invalid website URL format').optional().or(z.literal('')),

  source: leadSourceEnum.optional(),
  sourceDetails: z.string().trim().max(500).optional(),
  campaignName: z.string().trim().max(200).optional(),
  campaignId: z.string().trim().max(100).optional(),
  adSetName: z.string().trim().max(200).optional(),
  adId: z.string().trim().max(100).optional(),
  landingPageUrl: z.string().trim().max(500).optional(),

  estimatedValue: z.number().min(0).optional(),
  currency: z.string().trim().max(10).optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
  customFields: z.record(z.unknown()).optional(),

  nextFollowUpAt: z.string().datetime({ offset: true }).optional().nullable().or(z.date().optional()),
});

export const updateLeadStageSchema = z
  .object({
    stage: leadStageEnum,
    lostReason: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine(
    (data) => {
      if (data.stage === 'lost') {
        return typeof data.lostReason === 'string' && data.lostReason.trim().length > 0;
      }
      return true;
    },
    {
      message: 'A reason must be specified when transitioning a lead to Lost stage.',
      path: ['lostReason'],
    }
  );

export const assignLeadSchema = z.object({
  assignedTo: objectIdSchema.nullable(),
  notes: z.string().trim().max(500).optional(),
});

export const updateLeadScoreSchema = z.object({
  leadScore: z.number().min(0).max(100),
  reason: z.string().trim().max(500).optional(),
});

export const addLeadActivitySchema = z.object({
  activityType: z.enum([
    'note_added',
    'contact_attempt',
    'follow_up_scheduled',
  ]),
  description: z.string().trim().min(1, 'Description is required').max(1000),
  metadata: z.record(z.unknown()).optional(),
});

export const leadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  stage: z.string().trim().optional(),
  source: z.string().trim().optional(),
  assignedTo: z.string().trim().optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  followUpFilter: z.enum(['all', 'overdue', 'today', 'upcoming', 'none']).optional(),
  tags: z.string().trim().optional(),
  clientId: objectIdSchema.optional(),
  sortBy: z.enum(['createdAt', 'leadScore', 'nextFollowUpAt', 'fullName', 'estimatedValue']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeArchived: z.enum(['true', 'false']).optional(),
});

export const createWebhookSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  allowedSources: z.array(leadSourceEnum).default(['webhook', 'meta_ads', 'google_ads', 'organic', 'manual']),
});

export const updateWebhookStatusSchema = z.object({
  status: z.enum(['active', 'revoked', 'suspended']),
});

export const webhookIntakePayloadSchema = z.object({
  fullName: z.string().trim().max(200).optional(),
  name: z.string().trim().max(200).optional(),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().email('Invalid email address format').optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  company: z.string().trim().max(150).optional(),
  companyName: z.string().trim().max(150).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  website: z.string().trim().optional(),

  source: leadSourceEnum.optional(),
  sourceDetails: z.string().trim().max(500).optional(),
  campaignName: z.string().trim().max(200).optional(),
  campaignId: z.string().trim().max(100).optional(),
  adSetName: z.string().trim().max(200).optional(),
  adId: z.string().trim().max(100).optional(),
  landingPageUrl: z.string().trim().max(500).optional(),

  estimatedValue: z.number().min(0).optional(),
  notes: z.string().trim().max(2000).optional(),
  message: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim()).optional(),
  customFields: z.record(z.unknown()).optional(),
});
