import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { SwipeAction } from '../../../common/enums/swipe-action.enum';
import { DatingMode } from '../../../common/enums/dating-mode.enum';

export type SwipeDocument = HydratedDocument<Swipe>;

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
})
export class Swipe {
  @Prop({
    type: Types.ObjectId,
    ref: 'Pet',
    required: true,
  })
  fromPetId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Pet',
    required: true,
  })
  toPetId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: SwipeAction,
    required: true,
  })
  action!: SwipeAction;

  // Which mode pool this swipe happened in — a pet can be enabled for both
  // BREEDING and PLAYDATE, so a Match alone can't reconstruct which context
  // produced it after the fact. Purely for traceability (admin/analytics,
  // and the Matches List mode icon in the frontend) — swipe validity itself
  // is already fully enforced before this is ever written.
  @Prop({
    type: String,
    enum: DatingMode,
    required: true,
  })
  mode!: DatingMode;
}

export const SwipeSchema = SchemaFactory.createForClass(Swipe);

// A pet can't swipe the same pet twice *in the same mode* — DatingService
// .swipe() relies on this to detect a duplicate attempt via the resulting
// E11000 rather than a separate pre-check (same race-safety pattern as
// Tag.assignedPetId). Scoped to `mode` (not just the pair) because a pet
// pair can legitimately appear in both the BREEDING and PLAYDATE pools —
// e.g. two same-species pets that are both PLAYDATE- and BREEDING-enabled —
// and a PASS in one mode must not block a genuinely separate decision in
// the other.
SwipeSchema.index({ fromPetId: 1, toPetId: 1, mode: 1 }, { unique: true });
