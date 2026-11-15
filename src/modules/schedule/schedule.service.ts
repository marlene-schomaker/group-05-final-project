import { db } from '../../db/database.js';
import { DAYS, parseHour } from './schedule.validation.js';

const label = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

interface Slot {
  user_id: number;
  day_of_week: number;
  start_hour: number;
}

export class ScheduleService {
  static async get(userId: number) {
    const rows = await db
      .selectFrom('weekly_availability')
      .select(['day_of_week', 'start_hour'])
      .where('user_id', '=', userId)
      .orderBy('day_of_week')
      .orderBy('start_hour')
      .execute();

    const availability: Record<string, string[]> = {};
    for (const row of rows) {
      const day = DAYS[row.day_of_week];
      if (!day) continue;
      (availability[day] ??= []).push(label(row.start_hour));
    }
    return { availability };
  }

  static async replace(
    userId: number,
    availability: Partial<Record<string, string[]>>,
  ) {
    const slots: Slot[] = [];
    DAYS.forEach((day, dayIndex) => {
      const hours = new Set<number>();
      for (const value of availability[day] ?? []) {
        const hour = parseHour(value);
        if (hour !== null) hours.add(hour);
      }
      for (const hour of hours) {
        slots.push({
          user_id: userId,
          day_of_week: dayIndex,
          start_hour: hour,
        });
      }
    });

    await db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('weekly_availability')
        .where('user_id', '=', userId)
        .execute();
      if (slots.length > 0) {
        await trx.insertInto('weekly_availability').values(slots).execute();
      }
    });

    return ScheduleService.get(userId);
  }

  static async clear(userId: number) {
    await db
      .deleteFrom('weekly_availability')
      .where('user_id', '=', userId)
      .execute();
  }
}
