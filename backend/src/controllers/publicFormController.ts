import { Request, Response, NextFunction } from 'express';
import { FormSubmissionService } from '../services/formSubmission.service';
import { sendSuccess } from '../utils/response';

export const getPublicForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const origin = (req.headers.origin || req.headers.referer || '') as string;
    const form = await FormSubmissionService.getPublicForm(req.params.publicKey, origin);
    return sendSuccess(res, form, 'Public form definition retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const submitPublicForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '';
    const userAgent = (req.headers['user-agent'] as string) || '';
    const sourceUrl = (req.headers.referer || req.body?.sourceUrl || '') as string;
    const origin = (req.headers.origin || '') as string;

    const result = await FormSubmissionService.submitPublicForm(
      req.params.publicKey,
      req.body,
      {
        ip,
        userAgent,
        sourceUrl,
        origin,
        referrer: req.headers.referer as string,
      }
    );

    return sendSuccess(res, result, result.message || 'Form submitted successfully', 201);
  } catch (error) {
    next(error);
  }
};
