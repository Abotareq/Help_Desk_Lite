import { z } from 'zod';
import { RequestStatus } from '../../domain/enums/RequestStatus';

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
  }),
});

export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>['body'];
