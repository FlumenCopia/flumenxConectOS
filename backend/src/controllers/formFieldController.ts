import { Request, Response, NextFunction } from 'express';
import { FormFieldService } from '../services/formField.service';
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

export const listFields = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const fields = await FormFieldService.getFieldsByForm(clientId, req.params.formId);
    return sendSuccess(res, fields, 'Form fields retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const field = await FormFieldService.createField(clientId, req.params.formId, req.body);
    return sendSuccess(res, field, 'Form field created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const field = await FormFieldService.updateField(
      clientId,
      req.params.formId,
      req.params.fieldId,
      req.body
    );
    return sendSuccess(res, field, 'Form field updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteField = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    await FormFieldService.deleteField(clientId, req.params.formId, req.params.fieldId);
    return sendSuccess(res, null, 'Form field deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const reorderFields = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const fields = await FormFieldService.reorderFields(
      clientId,
      req.params.formId,
      req.body.fieldIds
    );
    return sendSuccess(res, fields, 'Form fields reordered successfully');
  } catch (error) {
    next(error);
  }
};
