import mongoose from 'mongoose';
import { ConversationActivity, IConversationActivity } from '../models/ConversationActivity';
import { logger } from '../config/logger';

export class ConversationActivityService {
  static async log(params: {
    clientId: string | mongoose.Types.ObjectId;
    conversationId: string | mongoose.Types.ObjectId;
    userId?: string | mongoose.Types.ObjectId;
    action: string;
    title: string;
    details?: Record<string, any>;
  }): Promise<IConversationActivity | null> {
    try {
      const clientObjectId =
        typeof params.clientId === 'string'
          ? new mongoose.Types.ObjectId(params.clientId)
          : (params.clientId as any)?._id || params.clientId;

      const conversationObjectId =
        typeof params.conversationId === 'string'
          ? new mongoose.Types.ObjectId(params.conversationId)
          : (params.conversationId as any)?._id || params.conversationId;

      const userObjectId = params.userId
        ? typeof params.userId === 'string'
          ? new mongoose.Types.ObjectId(params.userId)
          : (params.userId as any)?._id || params.userId
        : undefined;

      const activity = await ConversationActivity.create({
        clientId: clientObjectId,
        conversationId: conversationObjectId,
        userId: userObjectId,
        action: params.action,
        title: params.title,
        details: params.details || {},
      });

      return activity;
    } catch (error) {
      logger.error('Failed to log conversation activity:', error);
      return null;
    }
  }

  static async getByConversation(
    clientId: string,
    conversationId: string
  ): Promise<IConversationActivity[]> {
    return ConversationActivity.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      conversationId: new mongoose.Types.ObjectId(conversationId),
    })
      .populate('userId', 'name email avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50);
  }
}
