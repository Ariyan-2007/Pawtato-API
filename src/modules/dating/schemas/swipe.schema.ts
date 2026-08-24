import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { SwipeAction } from '../../../common/enums/swipe-action.enum';

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
}

export const SwipeSchema = SchemaFactory.createForClass(Swipe);

// A pet can't swipe the same pet twice — DatingService.swipe() relies on this
// to detect a duplicate attempt via the resulting E11000 rather than a
// separate pre-check (same race-safety pattern as Tag.assignedPetId).
SwipeSchema.index({ fromPetId: 1, toPetId: 1 }, { unique: true });
