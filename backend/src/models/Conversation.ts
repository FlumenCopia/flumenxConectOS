import mongoose, { Document, Schema, Model } from 'mongoose';

export type ConversationChannel = 'email' | 'sms' | 'whatsapp' | 'internal' | 'other';
export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'archived';
export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  contactId: mongoose.Types.ObjectId;
  leadId?: mongoose.Types.ObjectId;
  subject: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedTo?: mongoose.Types.ObjectId;
  lastMessageAt: Date;
  lastMessageSnippet: string;
  unreadCount: number;
  tags: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
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
    subject: {
      type: String,
      default: 'Direct Conversation',
      trim: true,
    },
    channel: {
      type: String,
      enum: ['email', 'sms', 'whatsapp', 'internal', 'other'],
      required: true,
      default: 'whatsapp',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'pending', 'resolved', 'archived'],
      required: true,
      default: 'open',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      required: true,
      default: 'medium',
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastMessageSnippet: {
      type: String,
      default: '',
      trim: true,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ConversationSchema.index({ clientId: 1, isArchived: 1, status: 1, lastMessageAt: -1 });
ConversationSchema.index({ clientId: 1, isArchived: 1, lastMessageAt: -1 });
ConversationSchema.index({ clientId: 1, channel: 1, lastMessageAt: -1 });
ConversationSchema.index({ clientId: 1, assignedTo: 1 });
ConversationSchema.index({ clientId: 1, contactId: 1 });

export const Conversation: Model<IConversation> =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>('Conversation', ConversationSchema);
