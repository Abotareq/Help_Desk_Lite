import { z } from 'zod';
import { RequestCategory } from '../../domain/enums/RequestCategory';
import { RequestPriority } from '../../domain/enums/RequestPriority';

/**
 * The minimum field set resolved from the PRD's open question. Title and
 * description are required; category is required but picked from a list rather
 * than typed, and priority defaults so the form stays a one-minute job.
 */
export const CreateRequestSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Title is required' })
      .trim()
      .min(5, 'Title must be at least 5 characters')
      .max(200, 'Title must be at most 200 characters'),
    description: z
      .string({ required_error: 'Description is required' })
      .trim()
      .min(15, 'Describe the issue in at least 15 characters so support does not have to chase you')
      .max(5000, 'Description must be at most 5000 characters'),
    category: z.nativeEnum(RequestCategory, {
      errorMap: () => ({ message: `Category must be one of: ${Object.values(RequestCategory).join(', ')}` }),
    }),
    priority: z.nativeEnum(RequestPriority).default(RequestPriority.MEDIUM),
  }),
});

export type CreateRequestInput = z.infer<typeof CreateRequestSchema>['body'];

export const RequestIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'A request id is required'),
  }),
});
