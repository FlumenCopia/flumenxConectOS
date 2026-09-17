import mongoose, { Document, Schema, Model } from 'mongoose';

export type MessageSenderType = 'user' | 'contact' | 'system' | 'bot';
export type MessageChannel = 'email' | 'sms' | 'whatsapp' | 'internal' | 'other';
export type MessageDirection = 'inbound' | 'outbound';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface IAttachment {
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
}

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderType: MessageSenderType;
  senderId?: mongoose.Types.ObjectId;
  senderName: string;
  senderEmail?: string;
  senderPhone?: string;
  channel: MessageChannel;
  direction: MessageDirection;
  body: string;
  deliveryStatus: DeliveryStatus;
  failureReason?: string;
  retryCount: number;
  externalMessageId?: string;
  idempotencyKey?: string;
  attachments: IAttachment[];
  isCustomerVisible: boolean;
  isInternal: boolean;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number },
    mimeType: { type: String },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderType: {
      type: String,
      enum: ['user', 'contact', 'system', 'bot'],
      required: true,
      default: 'user',
    },
    senderId: {
      type: Schema.Types.ObjectId,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    senderPhone: {
      type: String,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['email', 'sms', 'whatsapp', 'internal', 'other'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
      default: 'pending',
      index: true,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    externalMessageId: {
      type: String,
      trim: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },
    isCustomerVisible: {
      type: Boolean,
      default: true,
      index: true,
    },
    isInternal: {
      type: Boolean,
      default: false,
      index: true,
    },
    sentAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

MessageSchema.index({ clientId: 1, conversationId: 1, createdAt: 1 });
MessageSchema.index({ clientId: 1, conversationId: 1, isCustomerVisible: 1, isInternal: 1 });
MessageSchema.index({ clientId: 1, externalMessageId: 1 });
MessageSchema.index({ clientId: 1, idempotencyKey: 1 });

export const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
