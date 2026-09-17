import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IClientMembership extends Document {
  clientId: Types.ObjectId;
  userId: Types.ObjectId;
  roleId: Types.ObjectId;
  customPermissions: string[];
  status: 'active' | 'invited' | 'suspended';
  invitedAt?: Date;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const clientMembershipSchema = new Schema<IClientMembership>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
      index: true,
    },
    customPermissions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'suspended'],
      default: 'active',
      index: true,
    },
    invitedAt: {
      type: Date,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound unique index ensuring one membership record per user per client
clientMembershipSchema.index({ clientId: 1, userId: 1 }, { unique: true });

export const ClientMembership = mongoose.model<IClientMembership>(
  'ClientMembership',
  clientMembershipSchema
);
