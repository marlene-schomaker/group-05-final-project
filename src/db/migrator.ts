/* eslint-disable @typescript-eslint/no-explicit-any */
import { Migrator, Migration, MigrationProvider, Kysely } from 'kysely';
import * as initialSchema from './migrations/001_initial_schema.js';
import { db } from './database.js';
import dotenv from 'dotenv';

dotenv.config();

export function createMigrator(database: Kysely<any> = db): Migrator {
  const provider: MigrationProvider = {
    async getMigrations(): Promise<Record<string, Migration>> {
      return {
        '001_initial_schema': initialSchema,
      };
    },
  };

  return new Migrator({
    db: database,
    provider,
  });
}

export async function migrateToLatest(database: Kysely<any> = db) {
  const migrator = createMigrator(database);
  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`Migration "${it.migrationName}" executed successfully.`);
    } else if (it.status === 'Error') {
      console.error(`Failed to execute migration "${it.migrationName}".`);
    }
  });

  if (error) {
    console.error('Failed to migrate to latest:', error);
    throw error;
  }

  return results;
}

export async function migrateDown(database: Kysely<any> = db) {
  const migrator = createMigrator(database);
  const { error, results } = await migrator.migrateDown();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`Migration "${it.migrationName}" was reverted.`);
    } else if (it.status === 'Error') {
      console.error(`Failed to revert migration "${it.migrationName}".`);
    }
  });

  if (error) {
    console.error('Failed to migrate down:', error);
    throw error;
  }

  return results;
}

// Allow running directly via CLI
if (process.argv[1]?.includes('migrator')) {
  const action = process.argv[2] || 'up';
  if (action === 'down') {
    migrateDown()
      .then(() => db.destroy())
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else {
    migrateToLatest()
      .then(() => db.destroy())
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  }
}
