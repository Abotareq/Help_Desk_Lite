import { z } from 'zod';

/**
 * The body of a comment, shared by the comments endpoint and by a status change
 * that carries one. Defined once so a message posted with a move is validated
 * exactly like a message posted on its own.
 */
export const CommentBody = z.object({
  body: z
    .string({ required_error: 'A comment cannot be empty' })
    .trim()
    .min(1, 'A comment cannot be empty')
    .max(5000, 'A comment must be at most 5000 characters'),
  /** Handlers only — the service refuses this from anyone else. */
  isInternal: z.boolean().default(false),
});

export const AddCommentSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'A request id is required'),
  }),
  body: CommentBody,
});

export type AddCommentInput = z.infer<typeof CommentBody>;
