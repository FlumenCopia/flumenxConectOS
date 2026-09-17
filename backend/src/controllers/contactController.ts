import { Request, Response, NextFunction } from 'express';
import { ContactService } from '../services/contact.service';
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

export const getContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { search, page, limit } = req.query;

    const result = await ContactService.getContacts(clientId, {
      search: search as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    return sendSuccess(res, result, 'Contacts retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const getContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { contactId } = req.params;

    const contact = await ContactService.getContactById(clientId, contactId);
    return sendSuccess(res, contact, 'Contact retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const createContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const contact = await ContactService.createContact(clientId, req.body);
    return sendSuccess(res, contact, 'Contact created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { contactId } = req.params;

    const contact = await ContactService.updateContact(clientId, contactId, req.body);
    return sendSuccess(res, contact, 'Contact updated successfully');
  } catch (error) {
    return next(error);
  }
};
