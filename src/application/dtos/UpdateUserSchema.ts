import { z } from 'zod';
import { UserRole } from '../../domain/enums/UserRole';

/**
 * Email is deliberately absent: it is the account's identity and what the audit
 * trail is read against. Changing it is a different, riskier operation than
 * correcting a name or moving someone between roles.
 */
export const UpdateUserSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'A user id is required'),
  }),
  body: z
    .object({
      name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120).optional(),
      role: z.nativeEnum(UserRole).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'Provide at least one of name, role or isActive',
    }),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>['body'];

/**
 * Separate from the profile update on purpose. A password change should be an
 * explicit act, not something that can ride along inside a general edit.
 */
export const ResetPasswordSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'A user id is required'),
  }),
  body: z.object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters'),
  }),
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>['body'];
