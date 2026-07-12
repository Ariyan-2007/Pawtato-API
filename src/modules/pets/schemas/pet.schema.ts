import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PetDocument = HydratedDocument<Pet>;

@Schema({
  timestamps: true,
})
export class Pet {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  owner!: Types.ObjectId;
  @Prop({
   unique: true,
   index: true,
   })
  publicId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  name!: string;

  @Prop({
    required: true,
  })
  species!: string;

  @Prop({
    default: '',
  })
  breed!: string;

  @Prop({
    default: '',
  })
  gender!: string;

  @Prop({
    default: '',
  })
  color!: string;

  @Prop()
  birthDate?: Date;

  @Prop()
  weight?: number;

  @Prop({
    default: '',
  })
  profileImage!: string;

  @Prop({
    default: '',
  })
  qrCode!: string;

  @Prop({
    default: false,
  })
  isLost!: boolean;
  
}

export const PetSchema = SchemaFactory.createForClass(Pet);