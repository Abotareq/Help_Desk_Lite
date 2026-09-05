import { z } from 'zod';

/**
 * Assignment is single-owner in v1. A manager may reassign, and passing a null
 * assignee returns the request to the unclaimed queue.
 */
export const AssignRequestSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'A request id is required'),
  }),
  body: z.object({
    assigneeId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'assigneeId must be a valid user id')
      .nullable(),
  }),
});

export type AssignRequestInput = z.infer<typeof AssignRequestSchema>['body'];

export const ListMyRequestsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }),
});
