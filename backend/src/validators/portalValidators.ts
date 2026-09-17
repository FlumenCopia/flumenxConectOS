import { z } from 'zod';

export const portalLoginSchema = z.object({
  email: z.string().email('Valid email address is required').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10, 'Valid invitation token is required').trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name cannot be empty').max(100).trim().optional(),
  phone: z.string().max(30).trim().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email address is required').trim().toLowerCase(),
  clientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid client ID is required').optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Valid reset token is required').trim(),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const portalChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// Strict allowlist: Disallows arbitrary properties / mass assignment
export const updateProfileSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    phone: z.string().max(30).trim().optional(),
    communicationPreferences: z
      .object({
        email: z.boolean().optional(),
        sms: z.boolean().optional(),
        whatsapp: z.boolean().optional(),
        marketing: z.boolean().optional(),
      })
      .strict()
      .optional(),
    consentGiven: z.boolean().optional(),
  })
  .strict('Disallowed fields detected. Mass assignment is prohibited.');

export const profileChangeRequestSchema = z.object({
  fieldName: z.string().min(1).max(50).trim(),
  requestedValue: z.string().min(1).max(500).trim(),
  reason: z.string().max(1000).trim().optional(),
});

export const submitRequestSchema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200).trim(),
  description: z.string().min(5, 'Description must be at least 5 characters').max(5000).trim(),
  category: z.enum(['support', 'billing', 'inquiry', 'service_request', 'profile_change', 'other']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required').trim(),
  attachments: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(255),
        url: z.string().min(1),
        size: z.number().int().min(1).max(10 * 1024 * 1024, 'File exceeds 10MB limit'),
        mimeType: z.string().min(1),
      })
    )
    .max(5, 'Maximum of 5 attachments allowed per request')
    .optional()
    .default([]),
});

export const requestMessageSchema = z.object({
  body: z.string().min(1, 'Message body is required').max(3000, 'Message cannot exceed 3000 characters').trim(),
  attachments: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(255),
        url: z.string().min(1),
        size: z.number().int().min(1).max(10 * 1024 * 1024),
        mimeType: z.string().min(1),
      })
    )
    .max(5)
    .optional()
    .default([]),
  idempotencyKey: z.string().optional(),
});

export const customerConversationMessageSchema = z.object({
  body: z.string().min(1, 'Message body is required').max(3000).trim(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().min(1),
        size: z.number().optional(),
        mimeType: z.string().optional(),
      })
    )
    .max(5)
    .optional()
    .default([]),
  idempotencyKey: z.string().optional(),
});

export const customerTaskCommentSchema = z.object({
  comment: z.string().min(1, 'Comment is required').max(1000).trim(),
});

export const inviteCustomerSchema = z.object({
  contactId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid contact ID is required'),
  email: z.string().email().trim().toLowerCase().optional(),
  name: z.string().max(100).trim().optional(),
});

export const updateCustomerRequestStaffSchema = z.object({
  status: z.enum(['submitted', 'under_review', 'in_progress', 'completed', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedStaffId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
  comment: z.string().max(1000).optional(),
});

export const staffRequestMessageSchema = z.object({
  body: z.string().min(1).max(3000).trim(),
  isCustomerVisible: z.boolean().default(true),
  attachments: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        url: z.string().min(1),
        size: z.number(),
        mimeType: z.string(),
      })
    )
    .max(5)
    .optional()
    .default([]),
});
