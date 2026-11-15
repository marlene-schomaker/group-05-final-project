import { z } from 'zod';

export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export function parseHour(value: string): number | null {
  const text = value.trim();
  const twelve = /^(\d{1,2}):00\s*(AM|PM)$/i.exec(text);
  if (twelve) {
    const h = Number(twelve[1]);
    if (h < 1 || h > 12) return null;
    const pm = twelve[2]!.toUpperCase() === 'PM';
    return (h % 12) + (pm ? 12 : 0);
  }
  const twentyFour = /^(\d{1,2}):00$/.exec(text);
  if (twentyFour) {
    const h = Number(twentyFour[1]);
    return h >= 0 && h <= 23 ? h : null;
  }
  return null;
}

const hours = z
  .array(
    z
      .string()
      .refine(
        (v) => parseHour(v) !== null,
        'Use an hour like "09:00" or "9:00 AM"',
      ),
  )
  .max(24)
  .optional();

export const saveScheduleSchema = z.object({
  body: z.object({
    availability: z.object({
      Monday: hours,
      Tuesday: hours,
      Wednesday: hours,
      Thursday: hours,
      Friday: hours,
      Saturday: hours,
      Sunday: hours,
    }),
  }),
});
