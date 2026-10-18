import { db } from './database';
export async function setupDatabase() {
  await db.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo('now()').notNull())
    .execute();
  
  console.log('Database tables verified/created successfully.');
}