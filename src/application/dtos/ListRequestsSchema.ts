import { z } from 'zod';
import { RequestCategory } from '../../domain/enums/RequestCategory';
import { RequestPriority } from '../../domain/enums/RequestPriority';
import { RequestStatus } from '../../domain/enums/RequestStatus';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** Accepts `?status=NEW&status=WAITING` and `?status=NEW,WAITING` alike. */
function csvEnum<T extends Record<string, string>>(enumObject: T, label: string) {
  const values = Object.values(enumObject) as [string, ...string[]];

  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((raw) => {
      if (raw === undefined) return undefined;
      const parts = (Array.isArray(raw) ? raw : [raw])
        .flatMap((value) => value.split(','))
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      return parts.length > 0 ? parts : undefined;
    })
    .superRefine((parts, ctx) => {
      for (const part of parts ?? []) {
        if (!values.includes(part)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label} must be one of: ${values.join(', ')}`,
          });
        }
      }
    })
    .transform((parts) => parts as T[keyof T][] | undefined);
}

export const ListRequestsSchema = z.object({
  query: z.object({
    status: csvEnum(RequestStatus, 'status'),
    category: csvEnum(RequestCategory, 'category'),
    priority: csvEnum(RequestPriority, 'priority'),
    /** A user id, or the literal "unassigned" for the unclaimed queue. */
    assignee: z
      .string()
      .optional()
      .refine(
        (v) => v === undefined || v === 'unassigned' || OBJECT_ID.test(v),
        'assignee must be a user id or "unassigned"',
      ),
    requester: z
      .string()
      .regex(OBJECT_ID, 'requester must be a valid user id')
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status']).default('createdAt'),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export type ListRequestsQuery = z.infer<typeof ListRequestsSchema>['query'];

/** The stats endpoint takes the same filters, minus paging and sorting. */
export const RequestStatsSchema = z.object({
  query: z.object({
    status: csvEnum(RequestStatus, 'status'),
    category: csvEnum(RequestCategory, 'category'),
    priority: csvEnum(RequestPriority, 'priority'),
    assignee: z
      .string()
      .optional()
      .refine(
        (v) => v === undefined || v === 'unassigned' || OBJECT_ID.test(v),
        'assignee must be a user id or "unassigned"',
      ),
    requester: z.string().regex(OBJECT_ID, 'requester must be a valid user id').optional(),
  }),
});

export type RequestStatsQuery = z.infer<typeof RequestStatsSchema>['query'];
