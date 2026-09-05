import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { USER_ROLES, UserRole } from '../../../domain/enums/UserRole';

export interface UserDocument {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: USER_ROLES, default: UserRole.EMPLOYEE },
    // Never selected by default — a query has to ask for it explicitly.
    passwordHash: { type: String, required: true, select: false },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, versionKey: false },
);

export type UserHydrated = HydratedDocument<UserDocument>;

export const UserModel: Model<UserDocument> = model<UserDocument>('User', userSchema);
