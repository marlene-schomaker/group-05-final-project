import { z } from 'zod';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const timeOfDay = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
    'Time must be HH:MM or HH:MM:SS',
  );
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine(
    (v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)),
    'Date is not a valid calendar date',
  );

export const createEventSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Event name is required').max(200),
    minDurationMinutes: z.coerce
      .number()
      .int('Minimum duration must be a whole number of minutes')
      .min(15, 'Minimum duration must be at least 15 minutes')
      .max(1440, 'Minimum duration cannot exceed 24 hours'),
    minAttendees: z.coerce
      .number()
      .int('Minimum attendees must be a whole number')
      .min(1, 'Minimum attendees must be at least 1')
      .max(50, 'Minimum attendees cannot exceed 50'),
    inviteEmails: z
      .array(z.string().trim().email('Invalid email address').max(255))
      .max(100, 'At most 100 invitations at a time')
      .optional()
      .default([]),
  }),
  params: z.object({ groupId: z.coerce.number().int().positive() }),
});

export const eventIdParamSchema = z.object({ params: idParam });

export const respondInviteSchema = z.object({
  body: z.object({ response: z.enum(['yes', 'no']) }),
  params: idParam,
});

export const submitAvailabilitySchema = z.object({
  body: z.object({
    slots: z
      .array(
        z
          .object({ date: isoDate, startTime: timeOfDay, endTime: timeOfDay })
          .refine((s) => s.endTime > s.startTime, {
            message: 'End time must be after start time',
            path: ['endTime'],
          }),
      )
      .min(1, 'At least one time block is required')
      .max(200),
  }),
  params: idParam,
});
