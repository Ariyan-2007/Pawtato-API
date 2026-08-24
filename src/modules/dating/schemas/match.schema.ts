import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { MatchStatus } from '../../../common/enums/match-status.enum';

export type MatchDocument = HydratedDocument<Match>;

@Schema({
  timestamps: false,
})
export class Match {
  // Always stored in canonical order (petAId's hex string < petBId's) so a
  // lookup never has to check both orderings — see
  // DatingService.canonicalPetPair().
  @Prop({
    type: Types.ObjectId,
    ref: 'Pet',
    required: true,
  })
  petAId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Pet',
    required: true,
  })
  petBId!: Types.ObjectId;

  @Prop({
    default: () => new Date(),
  })
  matchedAt!: Date;

  @Prop({
    type: String,
    enum: MatchStatus,
    default: MatchStatus.ACTIVE,
  })
  status!: MatchStatus;

  // Owner userIds who've tapped "share my ID" within *this* match (Phase 11
  // — explicit per-match consent, not automatic on match). Sharing is
  // per-direction: a userId here makes that owner's NID viewable by the
  // other side, independent of whether the other side has shared back. See
  // DatingService.shareNid()/getNidExchange().
  @Prop({
    type: [Types.ObjectId],
    ref: 'User',
    default: [],
  })
  nidSharedBy!: Types.ObjectId[];
}

export const MatchSchema = SchemaFactory.createForClass(Match);

// A mutual like can only ever produce one Match for a given pair — this is
// the race-safety net for two near-simultaneous swipe requests both trying
// to create the match (see DatingService.swipe()'s duplicate-key handling).
MatchSchema.index({ petAId: 1, petBId: 1 }, { unique: true });
MatchSchema.index({ petAId: 1 });
MatchSchema.index({ petBId: 1 });
