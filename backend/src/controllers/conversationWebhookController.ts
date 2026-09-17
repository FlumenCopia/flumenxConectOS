import { Request, Response, NextFunction } from 'express';
import { ConversationWebhookService } from '../services/conversationWebhook.service';
import { sendSuccess } from '../utils/response';

export const handleInboundWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ConversationWebhookService.processInboundWebhook(
      req.headers,
      req.body,
      req.query.clientId as string | undefined
    );

    return sendSuccess(
      res,
      result,
      result.duplicate ? 'Webhook event acknowledged (duplicate)' : 'Inbound message processed successfully',
      result.duplicate ? 200 : 201
    );
  } catch (error) {
    return next(error);
  }
};
