import mongoose, { Document, Schema, Model } from 'mongoose';

export type SubmissionProcessingStatus =
  | 'received'
  | 'processing'
  | 'processed'
  | 'rejected'
  | 'failed';

export type SubmissionSpamStatus = 'clean' | 'spam' | 'suspicious';

export interface IFormSubmission extends Document {
  _id: mongoose.Types.ObjectId;
  formId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  submissionId: string;
  payload: Record<string, any>;
  normalizedPayload: Record<string, any>;
  leadId?: mongoose.Types.ObjectId;
  contactId?: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId;
  processingStatus: SubmissionProcessingStatus;
  spamStatus: SubmissionSpamStatus;
  sourceUrl?: string;
  referrer?: string;
  ipAddress?: string;
  userAgent?: string;
  failureReason?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FormSubmissionSchema = new Schema<IFormSubmission>(
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
    submissionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    normalizedPayload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      index: true,
    },
    processingStatus: {
      type: String,
      enum: ['received', 'processing', 'processed', 'rejected', 'failed'],
      default: 'received',
      index: true,
    },
    spamStatus: {
      type: String,
      enum: ['clean', 'spam', 'suspicious'],
      default: 'clean',
      index: true,
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
    referrer: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

FormSubmissionSchema.index({ clientId: 1, formId: 1, createdAt: -1 });
FormSubmissionSchema.index({ clientId: 1, processingStatus: 1 });

export const FormSubmission: Model<IFormSubmission> =
  mongoose.models.FormSubmission ||
  mongoose.model<IFormSubmission>('FormSubmission', FormSubmissionSchema);
