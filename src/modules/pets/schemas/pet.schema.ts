import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { PetGender } from '../../../common/enums/pet-gender.enum';

export type PetDocument = HydratedDocument<Pet>;

@Schema({
  timestamps: true,
})
export class Pet {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  owner!: Types.ObjectId;

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

  // Mandatory (Phase 12) — Breeding-mode dating match compatibility is
  // strictly opposite-gender, which is only enforceable if every pet has a
  // real, structured sex on file.
  @Prop({
    type: String,
    enum: PetGender,
    required: true,
  })
  gender!: PetGender;

  @Prop({
    default: '',
  })
  color!: string;

  @Prop()
  birthDate?: Date;

  @Prop()
  weight?: number;

  // One safety-relevant thing a stranger should know before approaching —
  // e.g. "Friendly but startles easily, approach calmly" or "May nip if
  // grabbed suddenly". Shown on the public scan profile.
  @Prop({
    trim: true,
    maxlength: 200,
  })
  notableTrait?: string;

  @Prop({
    default: '',
  })
  profileImage!: string;

  @Prop({
    default: false,
  })
  isLost!: boolean;

  @Prop()
  lostDate?: Date;

  @Prop()
  lastSeenLocation?: string;

  @Prop()
  lostDescription?: string;

  @Prop()
  reward?: number;

  @Prop()
  emergencyContact?: string;

  @Prop({
    default: 0,
  })
  scanCount!: number;

  @Prop()
  lastScannedAt?: Date;
}

export const PetSchema = SchemaFactory.createForClass(Pet);

// Backs PublicService.getLostPets() (`{ isLost: true }` sorted by `lostDate` desc)
// and the admin/statistics lost/recovered counters.
PetSchema.index({ isLost: 1, lostDate: -1 });
