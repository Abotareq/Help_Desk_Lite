export enum RequestPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export const REQUEST_PRIORITIES = Object.values(RequestPriority);

/** Sort weight for the handler queue — highest first. */
export const PRIORITY_WEIGHT: Record<RequestPriority, number> = {
  [RequestPriority.HIGH]: 3,
  [RequestPriority.MEDIUM]: 2,
  [RequestPriority.LOW]: 1,
};
