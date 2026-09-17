import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createConversationSchema = z
  .object({
    contactId: z.string().regex(objectIdRegex, 'Invalid contact ID format').optional(),
    contactName: z.string().min(1, 'Contact name is required if contactId is not provided').optional(),
    contactEmail: z.string().email('Invalid contact email').optional().or(z.literal('')),
    contactPhone: z.string().optional(),
    leadId: z.string().regex(objectIdRegex, 'Invalid lead ID format').optional().or(z.literal('')),
    subject: z.string().trim().min(1).default('Direct Conversation'),
    channel: z.enum(['email', 'sms', 'whatsapp', 'internal', 'other']).default('whatsapp'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    initialMessage: z.string().trim().optional(),
    tags: z.array(z.string().trim()).default([]),
    assignedTo: z.string().regex(objectIdRegex, 'Invalid user ID format').optional().or(z.literal('')),
  })
  .refine(
    (data) => data.contactId || data.contactName,
    {
      message: 'Either contactId or contactName must be provided',
      path: ['contactName'],
    }
  );

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message body cannot be empty'),
  channel: z.enum(['email', 'sms', 'whatsapp', 'internal', 'other']).optional(),
  idempotencyKey: z.string().trim().optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        size: z.number().optional(),
        mimeType: z.string().optional(),
      })
    )
    .default([]),
});

export const updateStatusSchema = z.object({
  status: z.enum(['open', 'pending', 'resolved', 'archived']),
});

export const updatePrioritySchema = z.object({
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

export const assignConversationSchema = z.object({
  assignedTo: z.string().regex(objectIdRegex, 'Invalid assigned user ID').nullable().optional(),
});

export const updateTagsSchema = z.object({
  tags: z.array(z.string().trim()),
});

export const createContactSchema = z
  .object({
    name: z.string().trim().min(1, 'Contact name is required'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().trim().optional(),
    avatarUrl: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
    leadId: z.string().regex(objectIdRegex, 'Invalid lead ID').optional().or(z.literal('')),
    metadata: z.record(z.any()).default({}),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone must be provided for a contact',
    path: ['email'],
  });

export const updateContactSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
  leadId: z.string().regex(objectIdRegex, 'Invalid lead ID').nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

export const inboundWebhookSchema = z.object({
  channel: z.enum(['email', 'sms', 'whatsapp', 'internal', 'other']),
  externalMessageId: z.string().trim().min(1, 'External message ID is required for idempotency'),
  from: z.object({
    name: z.string().trim().default('Inbound Contact'),
    email: z.string().email().optional(),
    phone: z.string().trim().optional(),
  }),
  body: z.string().trim().min(1, 'Message body cannot be empty'),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        size: z.number().optional(),
        mimeType: z.string().optional(),
      })
    )
    .default([]),
  timestamp: z.union([z.string(), z.number()]).optional(),
});

export const createProviderSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required'),
  providerType: z.enum([
    'mock',
    'resend',
    'twilio',
    'whatsapp',
    'meta_instagram',
    'meta_messenger',
    'custom_webhook',
  ]),
  configuration: z.record(z.any()).default({}),
  isDefault: z.boolean().default(false),
  status: z.enum(['active', 'inactive', 'error']).default('active'),
});

export const testProviderSchema = z.object({
  providerType: z.enum([
    'mock',
    'resend',
    'twilio',
    'whatsapp',
    'meta_instagram',
    'meta_messenger',
    'custom_webhook',
  ]),
  configuration: z.record(z.any()),
});
