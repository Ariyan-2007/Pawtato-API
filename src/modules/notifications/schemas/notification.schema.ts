import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user!: Types.ObjectId;

  // One of the DOMAIN_EVENTS values (src/common/events/domain-events.ts) —
  // kept as a plain string rather than a Mongoose enum so new event types
  // don't require a schema migration.
  @Prop({ type: String, required: true })
  type!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true })
  message!: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  data?: Record<string, unknown>;

  @Prop({ type: Date, default: null })
  readAt!: Date | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, readAt: 1 });
