import { z } from 'zod';

export const listNotificationsSchema = z.object({
  query: z.object({
    filter: z.enum(['all', 'invites', 'updates']).optional().default('all'),
  }),
});

export const notificationIdSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});
