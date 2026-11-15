import { z } from 'zod';

export const contactSupportSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    subject: z.string().min(1, 'Subject is required').max(200),
    message: z.string().min(1, 'Message is required').max(2000),
  }),
});
