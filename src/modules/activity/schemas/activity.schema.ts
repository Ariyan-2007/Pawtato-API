import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
  Types,
} from 'mongoose';

export type ActivityDocument =
  HydratedDocument<Activity>;

@Schema({
  timestamps: true,
})
export class Activity {

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  admin!: Types.ObjectId;

  @Prop({
    required: true,
  })
  action!: string;

  @Prop({
    required: true,
  })
  target!: string;

  @Prop({
    default: {},
  })
  metadata!: Record<string, any>;
}

export const ActivitySchema =
  SchemaFactory.createForClass(Activity);