import mongoose from 'mongoose';
import {
  FormSubmissionEvent,
  IFormSubmissionEvent,
  SubmissionEventType,
} from '../models/FormSubmissionEvent';
import { logger } from '../config/logger';

export class FormSubmissionEventService {
  /**
   * Records a fine-grained timeline event for a submission.
   */
  static async logEvent(params: {
    submissionId: string | mongoose.Types.ObjectId;
    formId: string | mongoose.Types.ObjectId;
    clientId: string | mongoose.Types.ObjectId;
    eventType: SubmissionEventType;
    description: string;
    metadata?: Record<string, any>;
  }): Promise<IFormSubmissionEvent> {
    try {
      const event = await FormSubmissionEvent.create({
        submissionId: new mongoose.Types.ObjectId(params.submissionId),
        formId: new mongoose.Types.ObjectId(params.formId),
        clientId: new mongoose.Types.ObjectId(params.clientId),
        eventType: params.eventType,
        description: params.description,
        metadata: params.metadata || {},
      });
      return event;
    } catch (err) {
      logger.error('Failed to log FormSubmissionEvent:', err);
      throw err;
    }
  }

  /**
   * Retrieves all event logs for a submission.
   */
  static async getEventsBySubmission(
    clientId: string,
    submissionId: string
  ): Promise<IFormSubmissionEvent[]> {
    return FormSubmissionEvent.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      submissionId: new mongoose.Types.ObjectId(submissionId),
    }).sort({ createdAt: 1 });
  }
}
