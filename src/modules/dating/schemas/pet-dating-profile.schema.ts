import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { DatingPurpose } from '../../../common/enums/dating-purpose.enum';

export type PetDatingProfileDocument = HydratedDocument<PetDatingProfile>;

@Schema({
  timestamps: true,
})
export class PetDatingProfile {
  // One profile per pet — enforced by the unique index below, not just a
  // uniqueness assumption. Ownership is always re-derived from `Pet.owner`
  // (via PetsService.findOwnedPet), never duplicated onto this document.
  @Prop({
    type: Types.ObjectId,
    ref: 'Pet',
    required: true,
    unique: true,
    index: true,
  })
  petId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: DatingPurpose,
    required: true,
  })
  purpose!: DatingPurpose;

  @Prop({
    trim: true,
    maxlength: 500,
  })
  bio?: string;

  @Prop({
    type: [String],
    default: [],
  })
  temperamentTags!: string[];

  // A curated gallery separate from Pet.profileImage — owner-supplied URLs
  // (e.g. already uploaded via the existing generic upload machinery), not a
  // dedicated upload endpoint of its own; see the Phase 10 roadmap note on
  // this scope decision.
  @Prop({
    type: [String],
    default: [],
  })
  photos!: string[];

  // Coarse only (city/area string, or a rounded lat/lng the frontend already
  // rounds before sending) — never the owner's precise address. This module
  // never resolves or stores anything more precise than what's given here.
  @Prop({
    trim: true,
    maxlength: 200,
  })
  approxLocation?: string;

  // Owner can pause visibility without deleting the profile (and its match
  // history) entirely.
  @Prop({
    default: true,
  })
  isActive!: boolean;

  // Only ever flipped true by DatingService.verifyHealth(), which itself
  // requires the pet to already have real Medical/Vaccination records — see
  // that method for the exact check. Never settable directly by the owner
  // through create/update.
  @Prop({
    default: false,
  })
  healthVerified!: boolean;
}

export const PetDatingProfileSchema =
  SchemaFactory.createForClass(PetDatingProfile);
