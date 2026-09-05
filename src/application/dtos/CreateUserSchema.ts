import { z } from 'zod';
import { UserRole } from '../../domain/enums/UserRole';

export const CreateUserSchema = z.object({
  body: z.object({
    email: z.string().email('A valid email is required'),
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
    role: z.nativeEnum(UserRole, {
      errorMap: () => ({ message: `Role must be one of: ${Object.values(UserRole).join(', ')}` }),
    }),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters'),
  }),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>['body'];

export const ListUsersSchema = z.object({
  query: z.object({
    role: z.nativeEnum(UserRole).optional(),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
  }),
});
