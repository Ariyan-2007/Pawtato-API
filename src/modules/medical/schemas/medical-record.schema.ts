import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MedicalRecordDocument = HydratedDocument<MedicalRecord>;

@Schema({
  timestamps: true,
})
export class MedicalRecord {
  @Prop({
    type: Types.ObjectId,
    ref: 'Pet',
    required: true,
  })
  pet!: Types.ObjectId;

  @Prop({
    required: true,
  })
  title!: string;

  @Prop()
  diagnosis?: string;

  @Prop()
  treatment?: string;

  @Prop()
  veterinarian?: string;

  @Prop()
  clinic?: string;

  @Prop()
  visitDate?: Date;

  @Prop()
  notes?: string;
}

export const MedicalRecordSchema = SchemaFactory.createForClass(MedicalRecord);
