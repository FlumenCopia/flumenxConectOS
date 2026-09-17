import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IConversationActivity extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  action: string;
  title: string;
  details?: Record<string, any>;
  createdAt: Date;
}

const ConversationActivitySchema = new Schema<IConversationActivity>(
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ConversationActivitySchema.index({ clientId: 1, conversationId: 1, createdAt: -1 });

export const ConversationActivity: Model<IConversationActivity> =
  mongoose.models.ConversationActivity ||
  mongoose.model<IConversationActivity>('ConversationActivity', ConversationActivitySchema);
