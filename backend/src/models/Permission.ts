import mongoose, { Document, Schema } from 'mongoose';

export interface IPermission extends Document {
  code: string;
  module: string;
  name: string;
  description?: string;
  createdAt: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    module: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

export const Permission = mongoose.model<IPermission>('Permission', permissionSchema);
