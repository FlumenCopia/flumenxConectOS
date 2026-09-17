import { Request, Response, NextFunction } from 'express';
import { BroadcastService } from '../services/broadcast.service';
import { createBroadcastSchema, uploadAttachmentSchema } from '../validators/broadcastValidators';
import { ClientMembership } from '../models/ClientMembership';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

const resolveScopeClientId = async (req: Request): Promise<string> => {
  const rawId =
    req.resolvedClientId ||
    (req.headers['x-client-id'] as string) ||
    (req.query.clientId as string) ||
    (req.body?.clientId as string);

  if (req.user!.isSuperAdmin) {
    if (rawId) return rawId.toString().trim();
    const active = await ClientMembership.findOne({ status: 'active' });
    if (active) return active.clientId.toString();
  }

  if (rawId) {
    const trimmed = rawId.toString().trim();
    const membership = await ClientMembership.findOne({
      userId: req.user!._id,
      clientId: trimmed,
      status: 'active',
    });
    if (!membership && !req.user!.isSuperAdmin) {
      throw new AppError('Access denied: You are not authorized for this client workspace.', 403);
    }
    return trimmed;
  }

  const defaultMembership = await ClientMembership.findOne({
    userId: req.user!._id,
    status: 'active',
  });
  if (!defaultMembership) {
    throw new AppError('No active client workspace found for current user.', 403);
  }
  return defaultMembership.clientId.toString();
};

export const createBroadcast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const parsed = createBroadcastSchema.parse(req.body);

    const campaign = await BroadcastService.createAndDispatchBroadcast(
      clientId,
      req.user!._id.toString(),
      parsed
    );

    return sendSuccess(res, campaign, 'Broadcast blast executed successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getBroadcasts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const result = await BroadcastService.getBroadcasts(clientId, page, limit);
    return sendSuccess(res, result, 'Broadcasts retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getBroadcastById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const campaign = await BroadcastService.getBroadcastById(clientId, req.params.broadcastId);
    return sendSuccess(res, campaign, 'Broadcast campaign details retrieved');
  } catch (err) {
    next(err);
  }
};

export const uploadBroadcastAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = uploadAttachmentSchema.parse(req.body);
    const fileName = parsed.fileName || parsed.filename || 'attachment';
    const result = await BroadcastService.saveUploadedAttachment(
      fileName,
      parsed.base64Data,
      parsed.mimeType
    );
    return sendSuccess(res, result, 'Media attachment uploaded successfully', 201);
  } catch (err) {
    next(err);
  }
};
