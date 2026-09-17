import { z } from 'zod';

export const createBroadcastSchema = z.object({
  name: z.string().min(1, 'Broadcast campaign name is required'),
  channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
  messageBody: z.string().min(1, 'Message body is required'),
  attachment: z
    .object({
      name: z.string(),
      url: z.string().min(1, 'Attachment URL is required'),
      mimeType: z.string().optional(),
      size: z.number().optional(),
    })
    .optional(),
  recipients: z
    .array(
      z.object({
        name: z.string().default('Customer'),
        phone: z.string().min(7, 'Phone number must be at least 7 characters'),
        email: z.string().email().optional().or(z.literal('')),
        customFields: z.record(z.string()).optional(),
      })
    )
    .min(1, 'At least one recipient is required'),
});

export const uploadAttachmentSchema = z
  .object({
    fileName: z.string().optional(),
    filename: z.string().optional(),
    base64Data: z.string().min(1, 'Base64 data is required'),
    mimeType: z.string().default('application/octet-stream'),
  })
  .refine((data) => !!(data.fileName || data.filename), {
    message: 'File name is required',
    path: ['fileName'],
  });

