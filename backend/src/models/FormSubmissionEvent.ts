import mongoose, { Document, Schema, Model } from 'mongoose';

export type SubmissionEventType =
  | 'submission_received'
  | 'validation_failed'
  | 'spam_rejected'
  | 'contact_created'
  | 'contact_matched'
  | 'lead_created'
  | 'lead_updated'
  | 'conversation_created'
  | 'notification_sent'
  | 'processing_failed';

export interface IFormSubmissionEvent extends Document {
  _id: mongoose.Types.ObjectId;
  submissionId: mongoose.Types.ObjectId;
  formId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  eventType: SubmissionEventType;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const FormSubmissionEventSchema = new Schema<IFormSubmissionEvent>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'FormSubmission',
      required: true,
      index: true,
    },
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
    eventType: {
      type: String,
      enum: [
        'submission_received',
        'validation_failed',
        'spam_rejected',
        'contact_created',
        'contact_matched',
        'lead_created',
        'lead_updated',
        'conversation_created',
        'notification_sent',
        'processing_failed',
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

FormSubmissionEventSchema.index({ submissionId: 1, createdAt: 1 });

export const FormSubmissionEvent: Model<IFormSubmissionEvent> =
  mongoose.models.FormSubmissionEvent ||
  mongoose.model<IFormSubmissionEvent>('FormSubmissionEvent', FormSubmissionEventSchema);
