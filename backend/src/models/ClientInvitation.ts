import mongoose, { Document, Schema, Types } from 'mongoose';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface IClientInvitation extends Document {
  clientId: Types.ObjectId;
  email: string;
  roleId: Types.ObjectId;
  tokenHash: string;
  invitedBy: Types.ObjectId;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const clientInvitationSchema = new Schema<IClientInvitation>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
      index: true,
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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes
clientInvitationSchema.index({ clientId: 1, email: 1 });

export const ClientInvitation = mongoose.model<IClientInvitation>(
  'ClientInvitation',
  clientInvitationSchema
);
