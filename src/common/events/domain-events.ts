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
  // Phase 12 — real-time dating signaling. DatingGateway (the Socket.IO
  // layer) listens on these three rather than DatingService reaching into
  // the gateway directly, same decoupling principle as every notification
  // trigger above: a REST-only client still works exactly as before, and a
  // socket-connected client gets these pushed live to the relevant match
  // room. This also means a message sent over the plain REST endpoint still
  // reaches the other side's open socket connection, not just messages sent
  // over the socket itself.
  DATING_MATCH_CREATED: 'dating.match-created',
  DATING_MESSAGE_SENT: 'dating.message-sent',
  DATING_MATCH_UNMATCHED: 'dating.match-unmatched',
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
  // Pet's isLost flag at scan time — decides notification priority/lifetime
  // (see notifications/utils/notification-priority.util.ts).
  isLost: boolean;
}

export interface FoundReportCreatedEvent {
  ownerId: string;
  ownerEmail: string;
  petId: string;
  petName: string;
  foundReportId: string;
  message: string;
  // Pet's isLost flag at report time — decides notification priority/lifetime
  // (see notifications/utils/notification-priority.util.ts).
  isLost: boolean;
}

export interface VaccinationReminderDueEvent {
  ownerId: string;
  ownerEmail: string;
  petName: string;
  vaccineName: string;
  nextDueDate: Date;
}

export interface DatingMatchCreatedEvent {
  matchId: string;
  petAId: string;
  petBId: string;
  // Owners of petA/petB respectively — lets DatingGateway push to both
  // users' personal socket room (`user:<id>`), not just the match room,
  // since neither side has necessarily joined the match room yet at the
  // moment a match is created.
  ownerAId: string;
  ownerBId: string;
}

export interface DatingMessageSentEvent {
  matchId: string;
  messageId: string;
  senderUserId: string;
  content: string;
  createdAt: Date;
  ownerAId: string;
  ownerBId: string;
}

export interface DatingMatchUnmatchedEvent {
  matchId: string;
  petAId: string;
  petBId: string;
  unmatchedBy: string;
  ownerAId: string;
  ownerBId: string;
}
