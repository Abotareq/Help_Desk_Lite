import { z } from 'zod';
import { RequestStatus } from '../../domain/enums/RequestStatus';
import { CommentBody } from './AddCommentSchema';

export const UpdateStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'A request id is required'),
  }),
  body: z.object({
    status: z.nativeEnum(RequestStatus, {
      errorMap: () => ({ message: `Status must be one of: ${Object.values(RequestStatus).join(', ')}` }),
    }),
    /** Optional context for the history entry — why it moved. */
    note: z.string().trim().max(1000, 'Note must be at most 1000 characters').optional(),
    /**
     * Optional message posted to the thread as part of the same move. Putting a
     * request on hold is the case this exists for: "waiting" without saying what
     * is needed is the ambiguity the request tracker is supposed to remove, and
     * unlike a history note, a comment is something the requester can answer.
     */
    comment: CommentBody.optional(),
  }),
});

export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>['body'];
