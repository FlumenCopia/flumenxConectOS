import crypto from 'crypto';
import mongoose from 'mongoose';
import { WebsiteForm, IWebsiteForm, FormStatus } from '../models/WebsiteForm';
import { WebsiteFormField, IWebsiteFormField } from '../models/WebsiteFormField';
import { FormSubmission } from '../models/FormSubmission';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';

export interface FormFilters {
  status?: FormStatus | 'all';
  search?: string;
  page?: number;
  limit?: number;
}

export class FormService {
  /**
   * Generates a collision-resistant public form key.
   */
  public static generatePublicKey(): string {
    return `form_pub_${crypto.randomBytes(12).toString('hex')}`;
  }

  /**
   * Lists website forms for a client workspace with pagination & filtering.
   */
  static async listForms(
    clientId: string,
    filters: FormFilters = {}
  ): Promise<{
    forms: any[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
    counts: { total: number; published: number; draft: number; paused: number; archived: number };
  }> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {
      clientId: clientObjectId,
    };

    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    } else {
      // By default exclude archived unless specifically requested
      query.status = { $ne: 'archived' };
    }

    if (filters.search && filters.search.trim()) {
      const searchRegex = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { description: searchRegex }, { publicKey: searchRegex }];
    }

    const [forms, total, totalAll, publishedCount, draftCount, pausedCount, archivedCount] =
      await Promise.all([
        WebsiteForm.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'name email'),
        WebsiteForm.countDocuments(query),
        WebsiteForm.countDocuments({ clientId: clientObjectId, status: { $ne: 'archived' } }),
        WebsiteForm.countDocuments({ clientId: clientObjectId, status: 'published' }),
        WebsiteForm.countDocuments({ clientId: clientObjectId, status: 'draft' }),
        WebsiteForm.countDocuments({ clientId: clientObjectId, status: 'paused' }),
        WebsiteForm.countDocuments({ clientId: clientObjectId, status: 'archived' }),
      ]);

    // Attach field count to each form
    const formIds = forms.map((f) => f._id);
    const fieldCounts = await WebsiteFormField.aggregate([
      { $match: { formId: { $in: formIds } } },
      { $group: { _id: '$formId', count: { $sum: 1 } } },
    ]);
    const fieldCountMap = new Map(fieldCounts.map((fc) => [fc._id.toString(), fc.count]));

    const enrichedForms = forms.map((f) => ({
      ...f.toJSON(),
      fieldsCount: fieldCountMap.get(f._id.toString()) || 0,
    }));

    return {
      forms: enrichedForms,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      counts: {
        total: totalAll,
        published: publishedCount,
        draft: draftCount,
        paused: pausedCount,
        archived: archivedCount,
      },
    };
  }

  /**
   * Retrieves a single form by ID along with its fields and submission stats.
   */
  static async getFormById(clientId: string, formId: string): Promise<any> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const formObjectId = new mongoose.Types.ObjectId(formId);

    const form = await WebsiteForm.findOne({
      _id: formObjectId,
      clientId: clientObjectId,
    }).populate('createdBy', 'name email');

    if (!form) {
      throw new AppError('Form not found in this workspace', 404);
    }

    const fields = await WebsiteFormField.find({
      formId: formObjectId,
      clientId: clientObjectId,
    }).sort({ order: 1, createdAt: 1 });

    const [processedCount, rejectedCount, failedCount, lastSubmission] = await Promise.all([
      FormSubmission.countDocuments({ formId: formObjectId, clientId: clientObjectId, processingStatus: 'processed' }),
      FormSubmission.countDocuments({ formId: formObjectId, clientId: clientObjectId, processingStatus: 'rejected' }),
      FormSubmission.countDocuments({ formId: formObjectId, clientId: clientObjectId, processingStatus: 'failed' }),
      FormSubmission.findOne({ formId: formObjectId, clientId: clientObjectId }).sort({ createdAt: -1 }).select('createdAt'),
    ]);

    return {
      ...form.toJSON(),
      fields,
      stats: {
        totalSubmissions: form.submissionsCount,
        processedCount,
        rejectedCount,
        failedCount,
        lastSubmissionAt: lastSubmission?.createdAt || null,
      },
    };
  }

  /**
   * Creates a new website form for the workspace.
   */
  static async createForm(
    clientId: string,
    userId: string,
    data: any
  ): Promise<any> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const publicKey = this.generatePublicKey();

    const form = await WebsiteForm.create({
      clientId: clientObjectId,
      name: data.name.trim(),
      description: data.description?.trim(),
      publicKey,
      status: 'draft',
      submitButtonLabel: data.submitButtonLabel?.trim() || 'Submit',
      successMessage: data.successMessage?.trim() || 'Thank you! Your submission has been received.',
      redirectUrl: data.redirectUrl?.trim() || undefined,
      allowedDomains: data.allowedDomains || [],
      notificationSettings: data.notificationSettings || { emailRecipients: [], notifyOnSubmission: true },
      captchaSettings: data.captchaSettings || { enabled: false, provider: 'mock' },
      honeypotField: data.honeypotField?.trim() || '_hp_website',
      createdBy: userObjectId,
    });

    // If initial fields provided, insert them
    if (data.fields && Array.isArray(data.fields) && data.fields.length > 0) {
      const fieldDocs = data.fields.map((field: any, idx: number) => ({
        formId: form._id,
        clientId: clientObjectId,
        fieldKey: field.fieldKey.trim(),
        label: field.label.trim(),
        type: field.type || 'text',
        placeholder: field.placeholder?.trim(),
        helpText: field.helpText?.trim(),
        required: field.required === true,
        options: field.options || [],
        defaultValue: field.defaultValue?.trim(),
        order: typeof field.order === 'number' ? field.order : idx,
        validationRules: field.validationRules || {},
        leadMapping: field.leadMapping || 'none',
        contactMapping: field.contactMapping || 'none',
        customFieldKey: field.customFieldKey?.trim(),
      }));
      await WebsiteFormField.insertMany(fieldDocs);
    } else {
      // Default starter fields for convenience
      const defaultFields = [
        {
          formId: form._id,
          clientId: clientObjectId,
          fieldKey: 'full_name',
          label: 'Full Name',
          type: 'text',
          placeholder: 'John Doe',
          required: true,
          order: 0,
          leadMapping: 'fullName',
          contactMapping: 'name',
        },
        {
          formId: form._id,
          clientId: clientObjectId,
          fieldKey: 'email',
          label: 'Business Email',
          type: 'email',
          placeholder: 'john@example.com',
          required: true,
          order: 1,
          leadMapping: 'email',
          contactMapping: 'email',
        },
        {
          formId: form._id,
          clientId: clientObjectId,
          fieldKey: 'phone',
          label: 'Phone Number',
          type: 'phone',
          placeholder: '+1 (555) 000-0000',
          required: false,
          order: 2,
          leadMapping: 'phone',
          contactMapping: 'phone',
        },
        {
          formId: form._id,
          clientId: clientObjectId,
          fieldKey: 'company',
          label: 'Company Name',
          type: 'text',
          placeholder: 'Acme Corp',
          required: false,
          order: 3,
          leadMapping: 'companyName',
          contactMapping: 'none',
        },
        {
          formId: form._id,
          clientId: clientObjectId,
          fieldKey: 'message',
          label: 'Message / Project Details',
          type: 'textarea',
          placeholder: 'How can we help your business grow?',
          required: false,
          order: 4,
          leadMapping: 'notes',
          contactMapping: 'none',
        },
      ];
      await WebsiteFormField.insertMany(defaultFields);
    }

    return this.getFormById(clientId, form._id.toString());
  }

  /**
   * Updates form settings and metadata.
   */
  static async updateForm(
    clientId: string,
    formId: string,
    userId: string,
    data: any
  ): Promise<any> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const formObjectId = new mongoose.Types.ObjectId(formId);

    const form = await WebsiteForm.findOne({
      _id: formObjectId,
      clientId: clientObjectId,
    });

    if (!form) {
      throw new AppError('Form not found', 404);
    }

    if (data.name !== undefined) form.name = data.name.trim();
    if (data.description !== undefined) form.description = data.description?.trim();
    if (data.submitButtonLabel !== undefined) form.submitButtonLabel = data.submitButtonLabel.trim();
    if (data.successMessage !== undefined) form.successMessage = data.successMessage.trim();
    if (data.redirectUrl !== undefined) form.redirectUrl = data.redirectUrl?.trim() || undefined;
    if (data.allowedDomains !== undefined) form.allowedDomains = data.allowedDomains;
    if (data.notificationSettings !== undefined) form.notificationSettings = data.notificationSettings;
    if (data.captchaSettings !== undefined) form.captchaSettings = data.captchaSettings;
    if (data.honeypotField !== undefined) form.honeypotField = data.honeypotField.trim();
    if (data.status !== undefined) form.status = data.status;

    await form.save();

    // If fields list is provided, update or recreate fields
    if (data.fields && Array.isArray(data.fields)) {
      await WebsiteFormField.deleteMany({ formId: formObjectId, clientId: clientObjectId });
      const fieldDocs = data.fields.map((field: any, idx: number) => ({
        formId: formObjectId,
        clientId: clientObjectId,
        fieldKey: field.fieldKey.trim(),
        label: field.label.trim(),
        type: field.type || 'text',
        placeholder: field.placeholder?.trim(),
        helpText: field.helpText?.trim(),
        required: field.required === true,
        options: field.options || [],
        defaultValue: field.defaultValue?.trim(),
        order: typeof field.order === 'number' ? field.order : idx,
        validationRules: field.validationRules || {},
        leadMapping: field.leadMapping || 'none',
        contactMapping: field.contactMapping || 'none',
        customFieldKey: field.customFieldKey?.trim(),
      }));
      await WebsiteFormField.insertMany(fieldDocs);
    }

    return this.getFormById(clientId, formId);
  }

  /**
   * Duplicates an existing form and its fields.
   */
  static async duplicateForm(
    clientId: string,
    formId: string,
    userId: string
  ): Promise<any> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const formObjectId = new mongoose.Types.ObjectId(formId);

    const original = await WebsiteForm.findOne({
      _id: formObjectId,
      clientId: clientObjectId,
    });

    if (!original) {
      throw new AppError('Form not found', 404);
    }

    const newPublicKey = this.generatePublicKey();

    const duplicatedForm = await WebsiteForm.create({
      clientId: clientObjectId,
      name: `${original.name} (Copy)`,
      description: original.description,
      publicKey: newPublicKey,
      status: 'draft',
      submitButtonLabel: original.submitButtonLabel,
      successMessage: original.successMessage,
      redirectUrl: original.redirectUrl,
      allowedDomains: original.allowedDomains,
      notificationSettings: original.notificationSettings,
      captchaSettings: original.captchaSettings,
      honeypotField: original.honeypotField,
      submissionsCount: 0,
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    const originalFields = await WebsiteFormField.find({
      formId: formObjectId,
      clientId: clientObjectId,
    });

    if (originalFields.length > 0) {
      const clonedFields = originalFields.map((f) => ({
        formId: duplicatedForm._id,
        clientId: clientObjectId,
        fieldKey: f.fieldKey,
        label: f.label,
        type: f.type,
        placeholder: f.placeholder,
        helpText: f.helpText,
        required: f.required,
        options: f.options,
        defaultValue: f.defaultValue,
        order: f.order,
        validationRules: f.validationRules,
        leadMapping: f.leadMapping,
        contactMapping: f.contactMapping,
        customFieldKey: f.customFieldKey,
      }));
      await WebsiteFormField.insertMany(clonedFields);
    }

    return this.getFormById(clientId, duplicatedForm._id.toString());
  }

  /**
   * Updates form status (draft, published, paused, archived).
   */
  static async updateStatus(
    clientId: string,
    formId: string,
    userId: string,
    status: FormStatus
  ): Promise<any> {
    const form = await WebsiteForm.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(formId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      { $set: { status } },
      { new: true }
    );

    if (!form) {
      throw new AppError('Form not found', 404);
    }

    return form;
  }

  /**
   * Archives a form.
   */
  static async archiveForm(clientId: string, formId: string, userId: string): Promise<any> {
    return this.updateStatus(clientId, formId, userId, 'archived');
  }

  /**
   * Generates embed code configurations for iframe and script embedding.
   */
  static async getEmbedConfig(clientId: string, formId: string): Promise<any> {
    const form = await this.getFormById(clientId, formId);
    const hostUrl = env.CORS_ORIGIN || 'http://localhost:3000';
    const formUrl = `${hostUrl}/public/forms/${form.publicKey}`;

    const scriptSnippet = `<div id="flumenx-form-${form.publicKey}"></div>\n<script src="${hostUrl}/embed/flumenx-form.js" data-form-key="${form.publicKey}" async></script>`;

    const iframeSnippet = `<iframe src="${formUrl}" width="100%" height="600" frameborder="0" style="border: none; max-width: 640px; width: 100%;" allow="camera; microphone; autoplay"></iframe>`;

    return {
      publicKey: form.publicKey,
      formName: form.name,
      status: form.status,
      standaloneUrl: formUrl,
      scriptSnippet,
      iframeSnippet,
      allowedDomains: form.allowedDomains,
    };
  }
}
