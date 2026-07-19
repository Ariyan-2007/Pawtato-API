import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VaccinationDocument =
  HydratedDocument<Vaccination>;

@Schema({
  timestamps: true,
})
export class Vaccination {
  @Prop({
    type: Types.ObjectId,
    ref: 'Pet',
    required: true,
    })
   pet!: Types.ObjectId;
  @Prop({
    default: false,
   })
  reminderSent!: boolean;

  @Prop()
  lastReminderSentAt?: Date;

  @Prop({
    required: true,
  })
  vaccineName!: string;

  @Prop({
    required: true,
  })
  administeredDate!: Date;

  @Prop({
    required: true,
  })
  nextDueDate!: Date;

  @Prop()
  veterinarian?: string;

  @Prop()
  clinic?: string;

  @Prop()
  notes?: string;
}

export const VaccinationSchema =
  SchemaFactory.createForClass(Vaccination);