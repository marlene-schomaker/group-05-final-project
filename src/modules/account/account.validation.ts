import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100).optional(),
    email: z.string().email('Invalid email address').max(255).optional(),
    avatarColor: z.string().optional(),
  }),
});

export const updatePreferencesSchema = z.object({
  body: z.object({
    prefInvites: z.boolean().optional(),
    prefConfirmed: z.boolean().optional(),
    prefEmail: z.boolean().optional(),
  }),
});
