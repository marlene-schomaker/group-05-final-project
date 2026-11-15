/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql, type Kysely } from 'kysely';

export async function createUsersTable(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('user_id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'varchar(255)', (col) => col.notNull())
    .addColumn('avatar_color', 'varchar(50)', (col) =>
      col.notNull().defaultTo('blue'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function up(db: Kysely<any>): Promise<void> {
  // Upgrade path from 001_initial_schema: keep existing users, replace the unused scheduling tables.
  await db.schema.dropTable('time_blocks').ifExists().execute();
  await db.schema.dropTable('events').ifExists().execute();
  await db.schema.dropTable('saved_schedules').ifExists().execute();
  await db.schema.dropTable('group_members').ifExists().execute();
  await db.schema.dropTable('groups').ifExists().execute();

  await db.schema.alterTable('users').renameColumn('id', 'user_id').execute();
  await db.schema
    .alterTable('users')
    .addColumn('name', 'varchar(100)', (col) => col.notNull().defaultTo(''))
    .execute();
  await sql`UPDATE users SET name = split_part(email, '@', 1)`.execute(db);
  await db.schema
    .alterTable('users')
    .alterColumn('name', (col) => col.dropDefault())
    .execute();
  await db.schema
    .alterTable('users')
    .addColumn('avatar_color', 'varchar(50)', (col) =>
      col.notNull().defaultTo('blue'),
    )
    .execute();
  await db.schema
    .alterTable('users')
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await createHuddleTables(db);
}

export async function createHuddleTables(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('refresh_tokens')
    .addColumn('token_id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('users.user_id').onDelete('cascade'),
    )
    .addColumn('token_hash', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('user_notification_preferences')
    .addColumn('user_id', 'integer', (col) =>
      col.primaryKey().references('users.user_id').onDelete('cascade'),
    )
    .addColumn('pref_invites', 'boolean', (col) =>
      col.notNull().defaultTo(true),
    )
    .addColumn('pref_confirmed', 'boolean', (col) =>
      col.notNull().defaultTo(true),
    )
    .addColumn('pref_email', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('groups')
    .addColumn('group_id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(150)', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('color', 'varchar(50)', (col) => col.notNull().defaultTo('blue'))
    .addColumn('created_by', 'integer', (col) =>
      col.notNull().references('users.user_id').onDelete('restrict'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('group_members')
    .addColumn('group_id', 'integer', (col) =>
      col.notNull().references('groups.group_id').onDelete('cascade'),
    )
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('users.user_id').onDelete('cascade'),
    )
    .addColumn('role', 'varchar(20)', (col) =>
      col.notNull().defaultTo('Member'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint('group_members_pkey', ['group_id', 'user_id'])
    .addCheckConstraint(
      'group_members_role_check',
      sql`role in ('Admin', 'Member')`,
    )
    .execute();

  await db.schema
    .createTable('events')
    .addColumn('event_id', 'serial', (col) => col.primaryKey())
    .addColumn('group_id', 'integer', (col) =>
      col.notNull().references('groups.group_id').onDelete('cascade'),
    )
    .addColumn('created_by', 'integer', (col) =>
      col.notNull().references('users.user_id').onDelete('restrict'),
    )
    .addColumn('name', 'varchar(200)', (col) => col.notNull())
    .addColumn('min_duration_minutes', 'integer', (col) => col.notNull())
    .addColumn('min_attendees', 'integer', (col) => col.notNull())
    .addColumn('status', 'varchar(30)', (col) =>
      col.notNull().defaultTo('Waiting for people'),
    )
    .addColumn('confirmed_start_time', 'timestamptz')
    .addColumn('confirmed_end_time', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint('events_duration_check', sql`min_duration_minutes > 0`)
    .addCheckConstraint('events_attendees_check', sql`min_attendees >= 1`)
    .addCheckConstraint(
      'events_status_check',
      sql`status in ('Waiting for people', 'Needs your reply', 'Confirmed', 'Cancelled')`,
    )
    .execute();

  await db.schema
    .createTable('event_invites')
    .addColumn('invite_id', 'serial', (col) => col.primaryKey())
    .addColumn('event_id', 'integer', (col) =>
      col.notNull().references('events.event_id').onDelete('cascade'),
    )
    .addColumn('email', 'varchar(255)', (col) => col.notNull())
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.user_id').onDelete('set null'),
    )
    .addColumn('invited_by', 'integer', (col) =>
      col.notNull().references('users.user_id').onDelete('restrict'),
    )
    .addColumn('response', 'varchar(20)', (col) =>
      col.notNull().defaultTo('pending'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('event_invites_event_email_unique', [
      'event_id',
      'email',
    ])
    .addCheckConstraint(
      'event_invites_response_check',
      sql`response in ('pending', 'yes', 'no')`,
    )
    .execute();

  await db.schema
    .createTable('open_time_blocks')
    .addColumn('block_id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('users.user_id').onDelete('cascade'),
    )
    .addColumn('event_id', 'integer', (col) =>
      col.references('events.event_id').onDelete('cascade'),
    )
    .addColumn('date', 'date', (col) => col.notNull())
    .addColumn('start_time', 'time', (col) => col.notNull())
    .addColumn('end_time', 'time', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      'open_time_blocks_time_order',
      sql`end_time > start_time`,
    )
    .execute();

  await db.schema
    .createTable('notifications')
    .addColumn('notification_id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('users.user_id').onDelete('cascade'),
    )
    .addColumn('type', 'varchar(50)', (col) => col.notNull())
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('body', 'text', (col) => col.notNull())
    .addColumn('icon', 'varchar(10)', (col) => col.notNull().defaultTo('@'))
    .addColumn('action_label', 'varchar(50)', (col) =>
      col.defaultTo('View event'),
    )
    .addColumn('action_url', 'varchar(255)')
    .addColumn('is_read', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('related_group_id', 'integer', (col) =>
      col.references('groups.group_id').onDelete('cascade'),
    )
    .addColumn('related_event_id', 'integer', (col) =>
      col.references('events.event_id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      'notifications_type_check',
      sql`type in ('event_invite', 'event_confirmed', 'event_status', 'member_joined', 'group_invite', 'system')`,
    )
    .execute();

  await db.schema
    .createTable('support_tickets')
    .addColumn('ticket_id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.user_id').onDelete('set null'),
    )
    .addColumn('email', 'varchar(255)', (col) => col.notNull())
    .addColumn('subject', 'varchar(200)', (col) => col.notNull())
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('status', 'varchar(30)', (col) =>
      col.notNull().defaultTo('open'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('group_invites')
    .addColumn('invite_id', 'serial', (col) => col.primaryKey())
    .addColumn('group_id', 'integer', (col) =>
      col.notNull().references('groups.group_id').onDelete('cascade'),
    )
    .addColumn('email', 'varchar(255)', (col) => col.notNull())
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.user_id').onDelete('cascade'),
    )
    .addColumn('invited_by', 'integer', (col) =>
      col.notNull().references('users.user_id').onDelete('cascade'),
    )
    .addColumn('status', 'varchar(20)', (col) =>
      col.notNull().defaultTo('pending'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('group_invites_group_email_unique', [
      'group_id',
      'email',
    ])
    .addCheckConstraint(
      'group_invites_status_check',
      sql`status in ('pending', 'accepted', 'declined')`,
    )
    .execute();

  await db.schema
    .createTable('email_outbox')
    .addColumn('email_id', 'serial', (col) => col.primaryKey())
    .addColumn('to_email', 'varchar(255)', (col) => col.notNull())
    .addColumn('subject', 'varchar(255)', (col) => col.notNull())
    .addColumn('body', 'text', (col) => col.notNull())
    .addColumn('status', 'varchar(20)', (col) =>
      col.notNull().defaultTo('queued'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .alterTable('open_time_blocks')
    .addUniqueConstraint('open_time_blocks_unique', [
      'event_id',
      'user_id',
      'date',
      'start_time',
      'end_time',
    ])
    .execute();

  await db.schema
    .createIndex('idx_group_members_user')
    .on('group_members')
    .column('user_id')
    .execute();
  await db.schema
    .createIndex('idx_events_group')
    .on('events')
    .column('group_id')
    .execute();
  await db.schema
    .createIndex('idx_event_invites_email')
    .on('event_invites')
    .column('email')
    .execute();
  await db.schema
    .createIndex('idx_event_invites_user')
    .on('event_invites')
    .column('user_id')
    .execute();
  await db.schema
    .createIndex('idx_notifications_user_read')
    .on('notifications')
    .columns(['user_id', 'is_read'])
    .execute();
  await db.schema
    .createIndex('idx_group_invites_email')
    .on('group_invites')
    .column('email')
    .execute();
  await db.schema
    .createIndex('idx_group_invites_user')
    .on('group_invites')
    .column('user_id')
    .execute();
  await db.schema
    .createIndex('idx_blocks_event')
    .on('open_time_blocks')
    .column('event_id')
    .execute();
  await db.schema
    .createIndex('idx_notifications_user_created')
    .on('notifications')
    .columns(['user_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  for (const table of [
    'email_outbox',
    'support_tickets',
    'notifications',
    'open_time_blocks',
    'event_invites',
    'events',
    'group_invites',
    'group_members',
    'groups',
    'user_notification_preferences',
    'refresh_tokens',
  ]) {
    await db.schema.dropTable(table).ifExists().execute();
  }

  await db.schema.alterTable('users').dropColumn('updated_at').execute();
  await db.schema.alterTable('users').dropColumn('avatar_color').execute();
  await db.schema.alterTable('users').dropColumn('name').execute();
  await db.schema.alterTable('users').renameColumn('user_id', 'id').execute();

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

  await db.schema
    .createTable('time_blocks')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('saved_schedule_id', 'integer', (col) =>
      col.references('saved_schedules.id').onDelete('cascade'),
    )
    .addColumn('event_id', 'integer', (col) =>
      col.references('events.id').onDelete('cascade'),
    )
    .addColumn('start_at', 'timestamptz', (col) => col.notNull())
    .addColumn('end_at', 'timestamptz', (col) => col.notNull())
    .addCheckConstraint('time_blocks_valid_range', sql`end_at > start_at`)
    .addCheckConstraint(
      'time_blocks_one_owner',
      sql`(saved_schedule_id IS NOT NULL) <> (event_id IS NOT NULL)`,
    )
    .execute();
}
