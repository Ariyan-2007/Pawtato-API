import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FoundReportDocument = HydratedDocument<FoundReport>;

@Schema({
  timestamps: true,
})
export class FoundReport {
  @Prop({
    type: Types.ObjectId,
    ref: 'Tag',
    required: true,
    index: true,
  })
  tag!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Pet',
    required: true,
    index: true,
  })
  pet!: Types.ObjectId;

  @Prop({
    required: true,
  })
  message!: string;

  @Prop()
  approxLocation?: string;

  @Prop()
  contactInfo?: string;

  @Prop()
  photoUrl?: string;

  // Opaque client-generated identifier (not tied to any account — this
  // endpoint is anonymous/no-auth) used to rate-limit spam/abuse. See
  // FoundReportsService.assertNotSpamming().
  @Prop({
    required: true,
    index: true,
  })
  deviceFingerprint!: string;

  @Prop({
    default: () => new Date(),
  })
  foundAt!: Date;
}

export const FoundReportSchema = SchemaFactory.createForClass(FoundReport);
