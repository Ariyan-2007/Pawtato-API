import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { DatingReportStatus } from '../../../common/enums/dating-report-status.enum';

export type DatingReportDocument = HydratedDocument<DatingReport>;

@Schema({
  timestamps: true,
})
export class DatingReport {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  reporterUserId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Pet',
    required: true,
    index: true,
  })
  targetPetId!: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
    maxlength: 1000,
  })
  reason!: string;

  @Prop({
    type: String,
    enum: DatingReportStatus,
    default: DatingReportStatus.PENDING,
    index: true,
  })
  status!: DatingReportStatus;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  reviewedBy!: Types.ObjectId | null;

  @Prop()
  reviewedAt?: Date;
}

export const DatingReportSchema = SchemaFactory.createForClass(DatingReport);
