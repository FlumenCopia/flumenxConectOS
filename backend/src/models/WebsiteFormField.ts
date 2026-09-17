import mongoose, { Document, Schema, Model } from 'mongoose';

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'hidden';

export type LeadFieldMapping =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'companyName'
  | 'jobTitle'
  | 'website'
  | 'estimatedValue'
  | 'notes'
  | 'customField'
  | 'none';

export type ContactFieldMapping = 'name' | 'email' | 'phone' | 'none';

export interface IFieldOption {
  label: string;
  value: string;
}

export interface IValidationRules {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface IWebsiteFormField extends Document {
  _id: mongoose.Types.ObjectId;
  formId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  fieldKey: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options: IFieldOption[];
  defaultValue?: string;
  order: number;
  validationRules: IValidationRules;
  leadMapping: LeadFieldMapping;
  contactMapping: ContactFieldMapping;
  customFieldKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FieldOptionSchema = new Schema<IFieldOption>(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ValidationRulesSchema = new Schema<IValidationRules>(
  {
    minLength: { type: Number },
    maxLength: { type: Number },
    min: { type: Number },
    max: { type: Number },
    pattern: { type: String },
  },
  { _id: false }
);

const WebsiteFormFieldSchema = new Schema<IWebsiteFormField>(
  {
    formId: {
      type: Schema.Types.ObjectId,
      ref: 'WebsiteForm',
      required: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    fieldKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: [
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
      ],
      required: true,
      default: 'text',
    },
    placeholder: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    helpText: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: {
      type: [FieldOptionSchema],
      default: [],
    },
    defaultValue: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    validationRules: {
      type: ValidationRulesSchema,
      default: {},
    },
    leadMapping: {
      type: String,
      enum: [
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
      ],
      default: 'none',
    },
    contactMapping: {
      type: String,
      enum: ['name', 'email', 'phone', 'none'],
      default: 'none',
    },
    customFieldKey: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

WebsiteFormFieldSchema.index({ formId: 1, order: 1 });
WebsiteFormFieldSchema.index({ clientId: 1, formId: 1 });

export const WebsiteFormField: Model<IWebsiteFormField> =
  mongoose.models.WebsiteFormField ||
  mongoose.model<IWebsiteFormField>('WebsiteFormField', WebsiteFormFieldSchema);
