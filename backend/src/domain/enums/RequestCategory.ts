/**
 * A small fixed set rather than free text — the PRD asks the submission form to
 * avoid free-text-only fields wherever a structured one reduces back-and-forth.
 * v1 stays a single queue; the category describes, it does not route.
 */
export enum RequestCategory {
  IT = 'IT',
  HR = 'HR',
  FACILITIES = 'FACILITIES',
  OTHER = 'OTHER',
}

export const REQUEST_CATEGORIES = Object.values(RequestCategory);
