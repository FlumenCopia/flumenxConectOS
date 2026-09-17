import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createClientSchema = z.object({
  name: z.string().trim().min(2, 'Client name must be at least 2 characters').max(100),
  slug: z.string().trim().min(2).max(100).optional(),
  legalName: z.string().trim().max(150).optional(),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  website: z.string().trim().max(255).optional().or(z.literal('')),
  industry: z.string().trim().max(100).optional().or(z.literal('')),
  address: z.string().trim().max(255).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  country: z.string().trim().max(100).optional().or(z.literal('')),
  timezone: z.string().trim().default('America/New_York'),
  currency: z.string().trim().default('USD'),
  logoUrl: z.string().trim().optional().or(z.literal('')),
  brandColor: z.string().trim().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid hex color code').optional().default('#1e40af'),
  status: z.enum(['active', 'onboarding', 'paused', 'inactive', 'archived', 'suspended']).default('onboarding'),
  health: z.enum(['healthy', 'needs_attention', 'at_risk', 'inactive']).default('healthy'),
  primaryAccountManagerId: z.string().regex(objectIdRegex, 'Invalid account manager ID').optional().or(z.literal('')),
  backupAccountManagerId: z.string().regex(objectIdRegex, 'Invalid account manager ID').optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const updateClientSchema = createClientSchema.partial();

export const updateClientStatusSchema = z.object({
  status: z.enum(['active', 'onboarding', 'paused', 'inactive', 'archived', 'suspended']),
  reason: z.string().trim().max(500).optional(),
});

export const updateClientHealthSchema = z.object({
  health: z.enum(['healthy', 'needs_attention', 'at_risk', 'inactive']),
  notes: z.string().trim().max(500).optional(),
});

export const assignManagersSchema = z.object({
  primaryAccountManagerId: z.string().regex(objectIdRegex, 'Invalid account manager ID').nullable().optional(),
  backupAccountManagerId: z.string().regex(objectIdRegex, 'Invalid backup account manager ID').nullable().optional(),
});

export const updateOnboardingItemSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'not_applicable']),
  notes: z.string().trim().max(1000).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const inviteClientUserSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  roleId: z.string().trim().min(1, 'Role ID or slug is required'),
});

export const updateUserRoleSchema = z.object({
  roleId: z.string().trim().min(1, 'Role ID or slug is required'),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'inactive']),
});

export const updateClientSettingsSchema = z.object({
  leadResponseThresholdMinutes: z.number().int().min(1).max(1440).optional(),
  notificationEmails: z.array(z.string().email()).optional(),
  brandPrimaryColor: z.string().trim().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid hex color').optional(),
  allowClientUserInvites: z.boolean().optional(),
  legalName: z.string().trim().max(150).optional(),
  phone: z.string().trim().max(30).optional(),
  website: z.string().trim().max(255).optional(),
  timezone: z.string().trim().optional(),
  currency: z.string().trim().optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10, 'Invitation token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
});

export const switchWorkspaceSchema = z.object({
  targetClientId: z.string().regex(objectIdRegex, 'Invalid client ID'),
});
