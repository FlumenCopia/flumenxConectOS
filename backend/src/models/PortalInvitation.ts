import mongoose, { Document, Schema, Types } from 'mongoose';

export type PortalInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface IPortalInvitation extends Document {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  contactId: Types.ObjectId;
  leadId?: Types.ObjectId;
  email: string;
  name: string;
  tokenHash: string;
  invitedBy: Types.ObjectId;
  status: PortalInvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  revokedBy?: Types.ObjectId;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PortalInvitationSchema = new Schema<IPortalInvitation>(
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
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      select: false,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'revoked'],
      default: 'pending',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

PortalInvitationSchema.set('toJSON', {
  transform: function (_doc, ret) {
    delete (ret as any).tokenHash;
    return ret;
  },
});

PortalInvitationSchema.set('toObject', {
  transform: function (_doc, ret) {
    delete (ret as any).tokenHash;
    return ret;
  },
});

PortalInvitationSchema.index({ clientId: 1, contactId: 1, status: 1 });
PortalInvitationSchema.index({ clientId: 1, email: 1, status: 1 });

export const PortalInvitation = mongoose.model<IPortalInvitation>('PortalInvitation', PortalInvitationSchema);
