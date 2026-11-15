/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function createWeeklyAvailabilityTable(
  db: Kysely<any>,
): Promise<void> {
  await db.schema
    .createTable('weekly_availability')
    .addColumn('slot_id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('users.user_id').onDelete('cascade'),
    )
    .addColumn('day_of_week', 'smallint', (col) => col.notNull())
    .addColumn('start_hour', 'smallint', (col) => col.notNull())
    .addUniqueConstraint('weekly_availability_unique', [
      'user_id',
      'day_of_week',
      'start_hour',
    ])
    .execute();

  await db.schema
    .createIndex('idx_weekly_availability_user')
    .on('weekly_availability')
    .column('user_id')
    .execute();
}

export async function up(db: Kysely<any>): Promise<void> {
  await createWeeklyAvailabilityTable(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('weekly_availability').ifExists().execute();
}
