import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import type {
  FoundReportCreatedEvent,
  PetMarkedFoundEvent,
  PetMarkedLostEvent,
  QrTagScannedEvent,
  TagAssignedEvent,
  TagUnassignedEvent,
  VaccinationReminderDueEvent,
} from '../../../common/events/domain-events';
import { NotificationsService } from '../notifications.service';
import { NotificationChannel } from '../interfaces/notification-channel.interface';
import { NOTIFICATION_CHANNELS } from '../notifications.constants';
import { renderNotification } from '../templates/notification-templates';

// The single place that turns a domain event into (a) a persisted in-app
// Notification and (b) a fan-out to every registered channel. Every module
// that emits one of these events stays fully unaware this file exists.
@Injectable()
export class DomainEventsListener {
  private readonly logger = new Logger(DomainEventsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,

    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
  ) {}

  private async handle(
    type: string,
    ownerId: string,
    payload: Record<string, unknown>,
  ) {
    const { title, message } = renderNotification(type, payload);

    try {
      await this.notificationsService.create(
        ownerId,
        type,
        title,
        message,
        payload,
      );
    } catch (error) {
      this.logger.error(
        `Failed to persist notification for event "${type}"`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    await Promise.all(
      this.channels.map((channel) => channel.send(ownerId, type, payload)),
    );
  }

  @OnEvent(DOMAIN_EVENTS.PET_MARKED_LOST)
  async onPetMarkedLost(event: PetMarkedLostEvent) {
    await this.handle(DOMAIN_EVENTS.PET_MARKED_LOST, event.ownerId, {
      ...event,
    });
  }

  @OnEvent(DOMAIN_EVENTS.PET_MARKED_FOUND)
  async onPetMarkedFound(event: PetMarkedFoundEvent) {
    await this.handle(DOMAIN_EVENTS.PET_MARKED_FOUND, event.ownerId, {
      ...event,
    });
  }

  @OnEvent(DOMAIN_EVENTS.TAG_ASSIGNED)
  async onTagAssigned(event: TagAssignedEvent) {
    await this.handle(DOMAIN_EVENTS.TAG_ASSIGNED, event.ownerId, {
      ...event,
    });
  }

  @OnEvent(DOMAIN_EVENTS.TAG_UNASSIGNED)
  async onTagUnassigned(event: TagUnassignedEvent) {
    await this.handle(DOMAIN_EVENTS.TAG_UNASSIGNED, event.ownerId, {
      ...event,
    });
  }

  @OnEvent(DOMAIN_EVENTS.QR_TAG_SCANNED)
  async onQrTagScanned(event: QrTagScannedEvent) {
    await this.handle(DOMAIN_EVENTS.QR_TAG_SCANNED, event.ownerId, {
      ...event,
    });
  }

  @OnEvent(DOMAIN_EVENTS.FOUND_REPORT_CREATED)
  async onFoundReportCreated(event: FoundReportCreatedEvent) {
    await this.handle(DOMAIN_EVENTS.FOUND_REPORT_CREATED, event.ownerId, {
      ...event,
    });
  }

  @OnEvent(DOMAIN_EVENTS.VACCINATION_REMINDER_DUE)
  async onVaccinationReminderDue(event: VaccinationReminderDueEvent) {
    await this.handle(DOMAIN_EVENTS.VACCINATION_REMINDER_DUE, event.ownerId, {
      ...event,
    });
  }
}
