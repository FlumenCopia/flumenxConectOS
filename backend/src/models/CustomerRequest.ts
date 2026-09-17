import mongoose, { Document, Schema, Types } from 'mongoose';

export type RequestCategory = 'support' | 'billing' | 'inquiry' | 'service_request' | 'profile_change' | 'other';
export type RequestPriority = 'low' | 'normal' | 'high' | 'urgent';
export type RequestStatus = 'submitted' | 'under_review' | 'in_progress' | 'completed' | 'closed';

export type AttachmentScanStatus = 'pending' | 'clean' | 'malicious' | 'scan_failed';

export interface IRequestAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  scanStatus: AttachmentScanStatus;
  scannedAt?: Date;
  scanVerdict?: string;
  scanExpiresAt?: Date;
  sha256?: string;
  quarantineKey?: string;
  quarantineBucket?: string;
  cleanStorageKey?: string;
}

export interface IRequestMessage {
  id: string;
  authorType: 'customer' | 'staff';
  authorId: Types.ObjectId;
  authorName: string;
  body: string;
  isCustomerVisible: boolean;
  attachments: IRequestAttachment[];
  idempotencyKey?: string;
  createdAt: Date;
}

export interface IRequestStatusChange {
  status: RequestStatus;
  changedBy: Types.ObjectId;
  changedByType: 'customer' | 'staff';
  comment?: string;
  changedAt: Date;
}

export interface ICustomerRequest extends Document {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  portalUserId: Types.ObjectId;
  contactId: Types.ObjectId;
  leadId?: Types.ObjectId;
  requestNumber: string;
  subject: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  idempotencyKey: string;
  attachments: IRequestAttachment[];
  linkedTaskId?: Types.ObjectId;
  assignedStaffId?: Types.ObjectId;
  messages: IRequestMessage[];
  statusHistory: IRequestStatusChange[];
  createdAt: Date;
  updatedAt: Date;
}

const RequestAttachmentSchema = new Schema<IRequestAttachment>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    scanStatus: {
      type: String,
      enum: ['pending', 'clean', 'malicious', 'scan_failed'],
      default: 'pending',
      required: true,
      index: true,
    },
    scannedAt: { type: Date },
    scanVerdict: { type: String },
    scanExpiresAt: { type: Date },
    sha256: { type: String },
    quarantineKey: { type: String },
    quarantineBucket: { type: String },
    cleanStorageKey: { type: String },
  },
  { _id: false }
);

const RequestMessageSchema = new Schema<IRequestMessage>(
  {
    id: { type: String, required: true },
    authorType: { type: String, enum: ['customer', 'staff'], required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    authorName: { type: String, required: true },
    body: { type: String, required: true, maxlength: 3000 },
    isCustomerVisible: { type: Boolean, default: true },
    attachments: [RequestAttachmentSchema],
    idempotencyKey: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RequestStatusChangeSchema = new Schema<IRequestStatusChange>(
  {
    status: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, required: true },
    changedByType: { type: String, enum: ['customer', 'staff'], required: true },
    comment: { type: String },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CustomerRequestSchema = new Schema<ICustomerRequest>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    portalUserId: {
      type: Schema.Types.ObjectId,
      ref: 'PortalUser',
      required: true,
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
    },
    requestNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    category: {
      type: String,
      enum: ['support', 'billing', 'inquiry', 'service_request', 'profile_change', 'other'],
      required: true,
      default: 'support',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'in_progress', 'completed', 'closed'],
      default: 'submitted',
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: [RequestAttachmentSchema],
    linkedTaskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
    },
    assignedStaffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    messages: [RequestMessageSchema],
    statusHistory: [RequestStatusChangeSchema],
  },
  {
    timestamps: true,
  }
);

CustomerRequestSchema.set('toJSON', {
  transform: function (_doc, ret: any) {
    if (Array.isArray(ret.attachments)) {
      ret.attachments.forEach((att: any) => {
        delete att.quarantineKey;
        delete att.quarantineBucket;
        delete att.cleanStorageKey;
      });
    }
    if (Array.isArray(ret.messages)) {
      ret.messages.forEach((msg: any) => {
        if (Array.isArray(msg.attachments)) {
          msg.attachments.forEach((att: any) => {
            delete att.quarantineKey;
            delete att.quarantineBucket;
            delete att.cleanStorageKey;
          });
        }
      });
    }
    return ret;
  },
});

CustomerRequestSchema.set('toObject', {
  transform: function (_doc, ret: any) {
    if (Array.isArray(ret.attachments)) {
      ret.attachments.forEach((att: any) => {
        delete att.quarantineKey;
        delete att.quarantineBucket;
        delete att.cleanStorageKey;
      });
    }
    if (Array.isArray(ret.messages)) {
      ret.messages.forEach((msg: any) => {
        if (Array.isArray(msg.attachments)) {
          msg.attachments.forEach((att: any) => {
            delete att.quarantineKey;
            delete att.quarantineBucket;
            delete att.cleanStorageKey;
          });
        }
      });
    }
    return ret;
  },
});

// Unique compound index for scoped request idempotency
CustomerRequestSchema.index({ clientId: 1, portalUserId: 1, idempotencyKey: 1 }, { unique: true });
CustomerRequestSchema.index({ clientId: 1, portalUserId: 1, createdAt: -1 });
CustomerRequestSchema.index({ clientId: 1, status: 1, createdAt: -1 });

export const CustomerRequest = mongoose.model<ICustomerRequest>('CustomerRequest', CustomerRequestSchema);
