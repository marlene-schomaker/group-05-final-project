import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void>{
    await db.schema
        .createTable('users')
        .addColumn('user_id', 'serial', (col) => col.primaryKey())
        .addColumn('name', 'varchar(100)', (col) => col.notNull())
        .addColumn('email', 'varchar(100)', (col) => col.notNull())
        .addColumn('password_hash', 'varchar(255)', (col) => col.notNull())
        .execute();
    
    
    await db.schema
        .createTable('groups')
        .addColumn('group_id', 'serial', (col) => col.primaryKey())
        .addColumn('name', 'varchar(100)', (col) => col.notNull())
        .execute()
    

    await db.schema
        .createTable('group_members')
        .addColumn('group_id', 'integer', (col) => col.notNull().references('groups.group_id').onDelete('cascade'),)
        .addColumn('user_id', 'integer', (col) => col.notNull().references('users.user_id').onDelete('cascade'),)
        .addPrimaryKeyConstraint('group_members_pkey', ['group_id', 'user_id'])
        .execute();


    await db.schema
    .createTable('open_time_blocks')
    .addColumn('block_id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('users.user_id').onDelete('cascade'),
    )
    .addColumn('date', 'date', (col) => col.notNull())
    .addColumn('start_time', 'time', (col) => col.notNull())
    .addColumn('end_time', 'time', (col) => col.notNull())
    .addCheckConstraint('open_time_blocks_time_order', sql`end_time > start_time`)
    .execute();

  await db.schema
    .createTable('event_types')
    .addColumn('event_type_id', 'serial', (col) => col.primaryKey())
    .addColumn('group_id', 'integer', (col) => col.notNull().references('groups.group_id').onDelete('cascade'),)
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('events')
    .addColumn('event_id', 'serial', (col) => col.primaryKey())
    .addColumn('group_id', 'integer', (col) => col.notNull().references('groups.group_id').onDelete('cascade'),)
    .addColumn('event_type_id', 'integer', (col) => col.notNull().references('event_types.event_type_id'),)
    .addColumn('status', 'varchar(20)', (col) => col.notNull().defaultTo('proposed'))
    .addColumn('start_datetime', 'timestamptz')
    .addColumn('end_datetime', 'timestamptz')
    .addCheckConstraint('events_status_check', sql`status in ('proposed', 'scheduled')`)
    .addCheckConstraint( 'events_scheduled_needs_times', sql`status = 'proposed' or (start_datetime is not null and end_datetime is not null)`,)
    .execute();

  await db.schema
    .createTable('event_invites')
    .addColumn('event_id', 'integer', (col) => col.notNull().references('events.event_id').onDelete('cascade'),)
    .addColumn('user_id', 'integer', (col) => col.notNull().references('users.user_id').onDelete('cascade'),)
    .addColumn('response', 'varchar(10)', (col) => col.notNull().defaultTo('pending'))
    .addPrimaryKeyConstraint('event_invites_pkey', ['event_id', 'user_id'])
    .addCheckConstraint('event_invites_response_check', sql`response in ('pending', 'yes', 'no')`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable('event_invites').execute();
    await db.schema.dropTable('events').execute();
    await db.schema.dropTable('event_types').execute();
    await db.schema.dropTable('open_time_blocks').execute();
    await db.schema.dropTable('group_members').execute();
    await db.schema.dropTable('groups').execute();
    await db.schema.dropTable('users').execute();
}