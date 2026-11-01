/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();

  await db.schema
    .createTable('groups')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();

  await db.schema
    .createTable('group_members')
    .addColumn('group_id', 'integer', (col) =>
      col.references('groups.id').onDelete('cascade').notNull(),
    )
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addPrimaryKeyConstraint('group_members_pkey', ['group_id', 'user_id'])
    .execute();

  await db.schema
    .createTable('saved_schedules')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();

  await db.schema
    .createTable('events')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('group_id', 'integer', (col) =>
      col.references('groups.id').onDelete('cascade').notNull(),
    )
    .addColumn('organizer_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('title', 'varchar(200)', (col) => col.notNull())
    .addColumn('duration_minutes', 'integer', (col) => col.notNull())
    .addColumn('min_attendees', 'integer', (col) => col.notNull())
    .addColumn('status', 'varchar(20)', (col) =>
      col.defaultTo('proposed').notNull(),
    )
    .addColumn('scheduled_start', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addCheckConstraint(
      'events_status_check',
      sql`status IN ('proposed', 'scheduled')`,
    )
    .addCheckConstraint(
      'events_scheduled_has_start',
      sql`(status = 'scheduled' AND scheduled_start IS NOT NULL)
        OR (status = 'proposed' AND scheduled_start IS NULL)`,
    )
    .addCheckConstraint(
      'events_positive_numbers',
      sql`duration_minutes > 0 AND min_attendees > 0`,
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('events').ifExists().execute();
  await db.schema.dropTable('saved_schedules').ifExists().execute();
  await db.schema.dropTable('group_members').ifExists().execute();
  await db.schema.dropTable('groups').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
}
