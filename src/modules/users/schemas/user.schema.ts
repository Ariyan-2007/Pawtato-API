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
}

export const UserSchema = SchemaFactory.createForClass(User);
