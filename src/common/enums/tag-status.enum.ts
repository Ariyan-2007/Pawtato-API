export enum TagStatus {
  // Created by its owner, not yet linked to a pet.
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  // Moderation-only states (admin), independent of the owner's own actions.
  SUSPENDED = 'SUSPENDED',
  RETIRED = 'RETIRED',
}
