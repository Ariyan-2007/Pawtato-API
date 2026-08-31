import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

import { LandingPageSectionKey } from '../../../common/enums/landing-page-section-key.enum';

export type LandingPageDocument = HydratedDocument<LandingPage>;

// Content varies by section `key` (a hero's `primaryCta` vs a FAQ's `faqs`)
// and is already fully validated against LandingPageSectionContentDto at the
// controller boundary before it ever reaches this schema — stored as Mixed
// here rather than duplicated as a second, parallel Mongoose schema.
@Schema({ _id: false })
export class LandingPageSection {
  @Prop({
    type: String,
    enum: LandingPageSectionKey,
    required: true,
  })
  key!: LandingPageSectionKey;

  @Prop({
    default: true,
  })
  enabled!: boolean;

  @Prop({
    required: true,
  })
  order!: number;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  content!: Record<string, unknown>;
}

export const LandingPageSectionSchema =
  SchemaFactory.createForClass(LandingPageSection);

// A single-document collection (see LandingPageService) — the landing page
// is one configurable resource, not a set of independently-keyed records, so
// there's nothing here to normalize into its own collection (Option A vs B
// in the design notes).
@Schema({ timestamps: true })
export class LandingPage {
  @Prop({
    type: [LandingPageSectionSchema],
    default: [],
  })
  sections!: LandingPageSection[];
}

export const LandingPageSchema = SchemaFactory.createForClass(LandingPage);
