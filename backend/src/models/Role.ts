import mongoose, { Document, Schema } from 'mongoose';

export interface IRole extends Document {
  name: string;
  slug: string;
  description?: string;
  isSystem: boolean;
  permissionCodes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    permissionCodes: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Role = mongoose.model<IRole>('Role', roleSchema);
