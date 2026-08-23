import { DOMAIN_EVENTS } from '../../../common/events/domain-events';

export interface RenderedNotification {
  title: string;
  message: string;
  // Whether this event type is worth an email, not just an in-app record —
  // e.g. a tag being (un)assigned or a routine scan isn't, a found report is.
  sendEmail: boolean;
}

function formatDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toDateString();
  }

  return String(value);
}

export function renderNotification(
  type: string,
  payload: Record<string, unknown>,
): RenderedNotification {
  const petName =
    typeof payload.petName === 'string' ? payload.petName : 'Your pet';

  switch (type) {
    case DOMAIN_EVENTS.PET_MARKED_LOST:
      return {
        title: 'Pet marked as lost',
        message: `${petName} was marked as lost. We'll notify you the moment someone reports finding them.`,
        sendEmail: true,
      };

    case DOMAIN_EVENTS.PET_MARKED_FOUND:
      return {
        title: 'Pet marked as found',
        message: `${petName} was marked as found. Glad they're back safe!`,
        sendEmail: true,
      };

    case DOMAIN_EVENTS.TAG_ASSIGNED:
      return {
        title: 'QR tag assigned',
        message: `A QR tag was assigned to ${petName}.`,
        sendEmail: false,
      };

    case DOMAIN_EVENTS.TAG_UNASSIGNED:
      return {
        title: 'QR tag unassigned',
        message: `The QR tag was removed from ${petName}.`,
        sendEmail: false,
      };

    case DOMAIN_EVENTS.QR_TAG_SCANNED:
      return {
        title: "Pet's tag was scanned",
        message: `${petName}'s QR tag was just scanned by someone.`,
        sendEmail: false,
      };

    case DOMAIN_EVENTS.FOUND_REPORT_CREATED:
      return {
        title: 'Someone may have found your pet!',
        message:
          typeof payload.message === 'string'
            ? payload.message
            : `Someone submitted a found report for ${petName}.`,
        sendEmail: true,
      };

    case DOMAIN_EVENTS.VACCINATION_REMINDER_DUE:
      return {
        title: 'Vaccination reminder',
        message: `${petName}'s vaccination "${String(payload.vaccineName)}" is due on ${formatDate(payload.nextDueDate)}.`,
        sendEmail: true,
      };

    default:
      return {
        title: 'Notification',
        message: 'You have a new notification.',
        sendEmail: false,
      };
  }
}
