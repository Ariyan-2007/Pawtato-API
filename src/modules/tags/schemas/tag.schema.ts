import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { TagStatus } from '../../../common/enums/tag-status.enum';

export type TagDocument = HydratedDocument<Tag>;

@Schema({
  timestamps: true,
})
export class Tag {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  publicCode!: string;

  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  serialNumber!: string;

  @Prop({
    type: String,
    enum: TagStatus,
    default: TagStatus.AVAILABLE,
  })
  status!: TagStatus;

  @Prop({
    type: Types.ObjectId,
    ref: 'Pet',
    default: null,
  })
  assignedPetId!: Types.ObjectId | null;

  @Prop({
    default: '',
  })
  qrImageUrl!: string;

  @Prop()
  assignedAt?: Date;

  @Prop()
  unassignedAt?: Date;
}

export const TagSchema = SchemaFactory.createForClass(Tag);

// Enforces "at most one active tag per pet" at the database level: only tags
// that currently have a real assignedPetId (i.e. status === ASSIGNED) are
// covered by the uniqueness constraint, so multiple unassigned (null) tags
// can coexist.
TagSchema.index(
  { assignedPetId: 1 },
  {
    unique: true,
    partialFilterExpression: { assignedPetId: { $type: 'objectId' } },
  },
);
