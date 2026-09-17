import mongoose from 'mongoose';
import { WebsiteFormField, IWebsiteFormField } from '../models/WebsiteFormField';
import { WebsiteForm } from '../models/WebsiteForm';
import { AppError } from '../middleware/errorHandler';

export class FormFieldService {
  /**
   * Lists all fields for a form in user-defined order.
   */
  static async getFieldsByForm(clientId: string, formId: string): Promise<IWebsiteFormField[]> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const formObjectId = new mongoose.Types.ObjectId(formId);

    // Verify form belongs to client
    const form = await WebsiteForm.findOne({ _id: formObjectId, clientId: clientObjectId });
    if (!form) {
      throw new AppError('Form not found', 404);
    }

    return WebsiteFormField.find({ formId: formObjectId, clientId: clientObjectId }).sort({
      order: 1,
      createdAt: 1,
    });
  }

  /**
   * Adds a new field to a form.
   */
  static async createField(
    clientId: string,
    formId: string,
    data: any
  ): Promise<IWebsiteFormField> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const formObjectId = new mongoose.Types.ObjectId(formId);

    const form = await WebsiteForm.findOne({ _id: formObjectId, clientId: clientObjectId });
    if (!form) {
      throw new AppError('Form not found', 404);
    }

    // Determine max order
    const lastField = await WebsiteFormField.findOne({ formId: formObjectId, clientId: clientObjectId })
      .sort({ order: -1 })
      .select('order');
    const nextOrder = typeof data.order === 'number' ? data.order : (lastField?.order ?? -1) + 1;

    const field = await WebsiteFormField.create({
      formId: formObjectId,
      clientId: clientObjectId,
      fieldKey: data.fieldKey.trim(),
      label: data.label.trim(),
      type: data.type || 'text',
      placeholder: data.placeholder?.trim(),
      helpText: data.helpText?.trim(),
      required: data.required === true,
      options: data.options || [],
      defaultValue: data.defaultValue?.trim(),
      order: nextOrder,
      validationRules: data.validationRules || {},
      leadMapping: data.leadMapping || 'none',
      contactMapping: data.contactMapping || 'none',
      customFieldKey: data.customFieldKey?.trim(),
    });

    return field;
  }

  /**
   * Updates an existing field.
   */
  static async updateField(
    clientId: string,
    formId: string,
    fieldId: string,
    data: any
  ): Promise<IWebsiteFormField> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const formObjectId = new mongoose.Types.ObjectId(formId);
    const fieldObjectId = new mongoose.Types.ObjectId(fieldId);

    const field = await WebsiteFormField.findOneAndUpdate(
      {
        _id: fieldObjectId,
        formId: formObjectId,
        clientId: clientObjectId,
      },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!field) {
      throw new AppError('Field not found', 404);
    }

    return field;
  }

  /**
   * Deletes a field.
   */
  static async deleteField(clientId: string, formId: string, fieldId: string): Promise<void> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const formObjectId = new mongoose.Types.ObjectId(formId);
    const fieldObjectId = new mongoose.Types.ObjectId(fieldId);

    const res = await WebsiteFormField.deleteOne({
      _id: fieldObjectId,
      formId: formObjectId,
      clientId: clientObjectId,
    });

    if (res.deletedCount === 0) {
      throw new AppError('Field not found', 404);
    }
  }

  /**
   * Reorders multiple fields for a form.
   */
  static async reorderFields(
    clientId: string,
    formId: string,
    fieldIdsInOrder: string[]
  ): Promise<IWebsiteFormField[]> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const formObjectId = new mongoose.Types.ObjectId(formId);

    const operations = fieldIdsInOrder.map((fieldId, index) => ({
      updateOne: {
        filter: {
          _id: new mongoose.Types.ObjectId(fieldId),
          formId: formObjectId,
          clientId: clientObjectId,
        },
        update: { $set: { order: index } },
      },
    }));

    if (operations.length > 0) {
      await WebsiteFormField.bulkWrite(operations);
    }

    return WebsiteFormField.find({ formId: formObjectId, clientId: clientObjectId }).sort({
      order: 1,
    });
  }
}
