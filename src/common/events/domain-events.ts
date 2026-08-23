// Shared, dependency-free event contracts. Any module may import this file to
// emit or listen without creating a module-to-module dependency edge — the
// emitter builds the full payload itself (ownerId/ownerEmail/petName), so the
// listener in NotificationsModule never needs to reach back into Pets/Users.

export const DOMAIN_EVENTS = {
  PET_MARKED_LOST: 'pet.marked-lost',
  PET_MARKED_FOUND: 'pet.marked-found',
  TAG_ASSIGNED: 'tag.assigned',
  TAG_UNASSIGNED: 'tag.unassigned',
  QR_TAG_SCANNED: 'qr.tag-scanned',
  FOUND_REPORT_CREATED: 'found-report.created',
  VACCINATION_REMINDER_DUE: 'vaccination.reminder-due',
} as const;

export type DomainEventName =
  (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export interface PetMarkedLostEvent {
  ownerId: string;
  ownerEmail: string;
  petId: string;
  petName: string;
}

export interface PetMarkedFoundEvent {
  ownerId: string;
  ownerEmail: string;
  petId: string;
  petName: string;
}

export interface TagAssignedEvent {
  ownerId: string;
  tagId: string;
  publicCode: string;
  petId: string;
  petName: string;
}

export interface TagUnassignedEvent {
  ownerId: string;
  tagId: string;
  publicCode: string;
  petId: string;
  petName: string;
}

export interface QrTagScannedEvent {
  ownerId: string;
  tagId: string;
  publicCode: string;
  petId: string;
  petName: string;
}

export interface FoundReportCreatedEvent {
  ownerId: string;
  ownerEmail: string;
  petId: string;
  petName: string;
  foundReportId: string;
  message: string;
}

export interface VaccinationReminderDueEvent {
  ownerId: string;
  ownerEmail: string;
  petName: string;
  vaccineName: string;
  nextDueDate: Date;
}
