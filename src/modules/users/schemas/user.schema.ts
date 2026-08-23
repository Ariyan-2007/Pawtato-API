import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole } from '../../../common/enums/user-role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
})
export class User {
  @Prop({
    required: true,
    trim: true,
  })
  fullName!: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email!: string;

  @Prop({
    required: true,
    select: false,
  })
  password!: string;

  @Prop({
    default: '',
  })
  phone!: string;

  @Prop({
    default: '',
  })
  address!: string;

  @Prop({
    default: '',
  })
  avatar!: string;

  @Prop({
    type: String,
    default: UserRole.USER,
    enum: UserRole,
  })
  role!: UserRole;

  @Prop({
    default: true,
  })
  isActive!: boolean;

  @Prop({
    default: false,
  })
  isEmailVerified!: boolean;

  // SHA-256 hash of the emailed verification token (not bcrypt — this needs
  // to be looked up directly by value, since the magic link carries only the
  // token, not the user's email; bcrypt's random salting makes that kind of
  // lookup impossible).
  @Prop({
    select: false,
    index: true,
  })
  emailVerificationTokenHash?: string;

  @Prop()
  emailVerificationExpiresAt?: Date;

  @Prop({
    select: false,
    index: true,
  })
  passwordResetTokenHash?: string;

  @Prop()
  passwordResetExpiresAt?: Date;

  // Any JWT issued before this timestamp is rejected by JwtStrategy — this is
  // what makes the password-reset email's "every other device has been
  // signed out" claim actually true despite JWTs otherwise being stateless.
  @Prop()
  passwordChangedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
