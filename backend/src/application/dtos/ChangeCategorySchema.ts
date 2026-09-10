import { z } from 'zod';
import { RequestCategory } from '../../domain/enums/RequestCategory';

/**
 * Recategorising an existing request. The same fixed list the submission form
 * offers — a category that describes rather than routes is only useful while
 * everyone is picking from the same set.
 */
export const ChangeCategorySchema = z.object({
  params: z.object({
    id: z.string().min(1, 'A request id is required'),
  }),
  body: z.object({
    category: z.nativeEnum(RequestCategory, {
      errorMap: () => ({
        message: `Category must be one of: ${Object.values(RequestCategory).join(', ')}`,
      }),
    }),
  }),
});

export type ChangeCategoryInput = z.infer<typeof ChangeCategorySchema>['body'];
