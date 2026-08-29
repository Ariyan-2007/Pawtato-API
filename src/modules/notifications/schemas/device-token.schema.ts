import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { DevicePlatform } from '../../../common/enums/device-platform.enum';

export type DeviceTokenDocument = HydratedDocument<DeviceToken>;

@Schema({
  timestamps: true,
})
export class DeviceToken {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  // Unique across all users, not just per-user — a token that gets
  // re-registered under a different account (device changed hands, or the
  // same user logged in again and the OS handed back the same token) should
  // move rather than duplicate; see NotificationsService.registerDeviceToken.
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  token!: string;

  @Prop({
    type: String,
    enum: DevicePlatform,
    required: true,
  })
  platform!: DevicePlatform;
}

export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);
