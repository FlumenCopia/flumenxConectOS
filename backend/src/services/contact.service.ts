import mongoose from 'mongoose';
import { Contact, IContact } from '../models/Contact';
import { Lead } from '../models/Lead';
import { AppError } from '../middleware/errorHandler';

export class ContactService {
  static async getContacts(
    clientId: string,
    filters: { search?: string; page?: number; limit?: number }
  ): Promise<{ contacts: IContact[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };

    if (filters.search && filters.search.trim()) {
      const searchRegex = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .populate('leadId', 'stage leadScore source company')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Contact.countDocuments(query),
    ]);

    return {
      contacts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getContactById(clientId: string, contactId: string): Promise<IContact> {
    const contact = await Contact.findOne({
      _id: new mongoose.Types.ObjectId(contactId),
      clientId: new mongoose.Types.ObjectId(clientId),
    }).populate('leadId');

    if (!contact) {
      throw new AppError('Contact not found in this workspace', 404);
    }
    return contact;
  }

  static async createContact(
    clientId: string,
    data: {
      name: string;
      email?: string;
      phone?: string;
      avatarUrl?: string;
      leadId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<IContact> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    // If leadId is passed, verify it belongs to the same client
    if (data.leadId) {
      const lead = await Lead.findOne({
        _id: new mongoose.Types.ObjectId(data.leadId),
        clientId: clientObjectId,
      });
      if (!lead) {
        throw new AppError('Linked lead not found in this workspace', 404);
      }
    }

    const contact = await Contact.create({
      clientId: clientObjectId,
      name: data.name.trim(),
      email: data.email?.trim().toLowerCase() || undefined,
      phone: data.phone?.trim() || undefined,
      avatarUrl: data.avatarUrl?.trim() || undefined,
      leadId: data.leadId ? new mongoose.Types.ObjectId(data.leadId) : undefined,
      metadata: data.metadata || {},
    });

    return contact;
  }

  static async updateContact(
    clientId: string,
    contactId: string,
    data: Partial<IContact>
  ): Promise<IContact> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    if (data.leadId) {
      const lead = await Lead.findOne({
        _id: new mongoose.Types.ObjectId(data.leadId as any),
        clientId: clientObjectId,
      });
      if (!lead) {
        throw new AppError('Linked lead not found in this workspace', 404);
      }
    }

    const contact = await Contact.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(contactId),
        clientId: clientObjectId,
      },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!contact) {
      throw new AppError('Contact not found', 404);
    }
    return contact;
  }

  static async findOrCreateContact(
    clientId: string,
    data: { name: string; email?: string; phone?: string; leadId?: string }
  ): Promise<IContact> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const queryConditions: any[] = [];

    if (data.email && data.email.trim()) {
      queryConditions.push({ email: data.email.trim().toLowerCase() });
    }
    if (data.phone && data.phone.trim()) {
      queryConditions.push({ phone: data.phone.trim() });
    }

    if (queryConditions.length > 0) {
      const existing = await Contact.findOne({
        clientId: clientObjectId,
        $or: queryConditions,
      });
      if (existing) {
        // Update name or lead if needed
        if (data.leadId && !existing.leadId) {
          existing.leadId = new mongoose.Types.ObjectId(data.leadId);
          await existing.save();
        }
        return existing;
      }
    }

    return this.createContact(clientId, data);
  }
}
