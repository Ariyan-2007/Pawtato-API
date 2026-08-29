import { Injectable, Logger } from '@nestjs/common';

import { NotificationChannel } from '../interfaces/notification-channel.interface';
import { NotificationsService } from '../notifications.service';
import { renderNotification } from '../templates/notification-templates';

// Stub implementation — no push provider (FCM/APNs) is configured yet.
// Device-token storage is real (see DeviceToken/NotificationsController's
// device-tokens endpoints); only the actual "send" call is a log line
// instead of a real FCM/APNs request. Swapping in a real provider later is a
// change to this one file's send() body, not to anything that calls it.
@Injectable()
export class PushChannel implements NotificationChannel {
  private readonly logger = new Logger(PushChannel.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  async send(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const { title, message, sendPush } = renderNotification(type, payload);

    if (!sendPush) {
      return;
    }

    try {
      const deviceTokens =
        await this.notificationsService.getDeviceTokens(userId);

      if (deviceTokens.length === 0) {
        return;
      }

      this.logger.log(
        `[stub] would push to ${deviceTokens.length} device(s) for event "${type}" (user ${userId}): ${title} — ${message}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send push for event "${type}" to user ${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
