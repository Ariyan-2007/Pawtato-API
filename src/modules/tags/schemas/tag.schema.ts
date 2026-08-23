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

  // The user who created (and therefore owns) this tag — the authority for
  // who may assign/unassign/delete it, independent of which pet it happens
  // to be linked to at any given moment.
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  ownerId!: Types.ObjectId;

  // The full URL encoded into the QR image (the frontend's landing route +
  // this tag's publicCode) — stored so it doesn't need to be reconstructed
  // and so it's inspectable directly on the tag record.
  @Prop({
    required: true,
  })
  linkUrl!: string;

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
