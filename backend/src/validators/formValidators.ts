import { z } from 'zod';

const fieldTypeEnum = z.enum([
  'text',
  'email',
  'phone',
  'textarea',
  'number',
  'select',
  'radio',
  'checkbox',
  'date',
  'hidden',
]);

const leadMappingEnum = z.enum([
  'fullName',
  'firstName',
  'lastName',
  'email',
  'phone',
  'companyName',
  'jobTitle',
  'website',
  'estimatedValue',
  'notes',
  'customField',
  'none',
]);

const contactMappingEnum = z.enum(['name', 'email', 'phone', 'none']);

const fieldOptionSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
});

const validationRulesSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
}).optional();

export const createFormFieldSchema = z.object({
  fieldKey: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Field key must be alphanumeric or underscores/hyphens'),
  label: z.string().min(1).max(200),
  type: fieldTypeEnum.default('text'),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional(),
  required: z.boolean().default(false),
  options: z.array(fieldOptionSchema).optional().default([]),
  defaultValue: z.string().optional(),
  order: z.number().optional().default(0),
  validationRules: validationRulesSchema,
  leadMapping: leadMappingEnum.default('none'),
  contactMapping: contactMappingEnum.default('none'),
  customFieldKey: z.string().max(100).optional(),
});

export const updateFormFieldSchema = createFormFieldSchema.partial();

export const reorderFieldsSchema = z.object({
  fieldIds: z.array(z.string().min(1)).min(1, 'Must provide at least one field ID'),
});

export const createFormSchema = z.object({
  name: z.string().min(1, 'Form name is required').max(200),
  description: z.string().max(1000).optional(),
  submitButtonLabel: z.string().max(100).optional().default('Submit'),
  successMessage: z.string().max(1000).optional().default('Thank you! Your submission has been received.'),
  redirectUrl: z.string().url().max(2048).optional().or(z.literal('')),
  allowedDomains: z.array(z.string()).optional().default([]),
  notificationSettings: z
    .object({
      emailRecipients: z.array(z.string().email()).optional().default([]),
      notifyOnSubmission: z.boolean().default(true),
    })
    .optional()
    .default({ emailRecipients: [], notifyOnSubmission: true }),
  captchaSettings: z
    .object({
      enabled: z.boolean().default(false),
      provider: z.enum(['mock', 'recaptcha_v3', 'hcaptcha']).default('mock'),
      siteKey: z.string().optional(),
    })
    .optional()
    .default({ enabled: false, provider: 'mock' }),
  honeypotField: z.string().max(100).optional().default('_hp_website'),
  fields: z.array(createFormFieldSchema).optional(),
});

export const updateFormSchema = createFormSchema.partial();

export const updateFormStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'paused', 'archived']),
});

export const publicSubmissionSchema = z.object({
  payload: z.record(z.any()).optional().default({}),
  _form_loaded_at: z.union([z.number(), z.string()]).optional(),
  submissionId: z.string().optional(),
  sourceUrl: z.string().optional(),
  referrer: z.string().optional(),
}).passthrough();
