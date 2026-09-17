import { Request, Response, NextFunction } from 'express';
import { FormService } from '../services/form.service';
import { FormSubmissionService } from '../services/formSubmission.service';
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

export const listForms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const filters = {
      status: req.query.status as any,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    };

    const result = await FormService.listForms(clientId, filters);
    return sendSuccess(res, result, 'Forms retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const form = await FormService.getFormById(clientId, req.params.formId);
    return sendSuccess(res, form, 'Form details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const form = await FormService.createForm(clientId, req.user!._id.toString(), req.body);
    return sendSuccess(res, form, 'Form created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const form = await FormService.updateForm(clientId, req.params.formId, req.user!._id.toString(), req.body);
    return sendSuccess(res, form, 'Form updated successfully');
  } catch (error) {
    next(error);
  }
};

export const duplicateForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const form = await FormService.duplicateForm(clientId, req.params.formId, req.user!._id.toString());
    return sendSuccess(res, form, 'Form duplicated successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateFormStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const form = await FormService.updateStatus(clientId, req.params.formId, req.user!._id.toString(), req.body.status);
    return sendSuccess(res, form, `Form status updated to ${req.body.status}`);
  } catch (error) {
    next(error);
  }
};

export const archiveForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const form = await FormService.archiveForm(clientId, req.params.formId, req.user!._id.toString());
    return sendSuccess(res, form, 'Form archived successfully');
  } catch (error) {
    next(error);
  }
};

export const getEmbedConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const embedConfig = await FormService.getEmbedConfig(clientId, req.params.formId);
    return sendSuccess(res, embedConfig, 'Embed code generated successfully');
  } catch (error) {
    next(error);
  }
};

export const listSubmissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const formId = req.params.formId || (req.query.formId as string);
    const filters = {
      status: req.query.status as string,
      spamStatus: req.query.spamStatus as string,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    };

    const result = await FormSubmissionService.listSubmissions(clientId, formId, filters);
    return sendSuccess(res, result, 'Submissions retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getSubmission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const submission = await FormSubmissionService.getSubmissionById(clientId, req.params.submissionId);
    return sendSuccess(res, submission, 'Submission retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const reprocessSubmission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const submission = await FormSubmissionService.reprocessSubmission(
      clientId,
      req.params.submissionId,
      req.user!._id.toString()
    );
    return sendSuccess(res, submission, 'Submission reprocessed successfully');
  } catch (error) {
    next(error);
  }
};
