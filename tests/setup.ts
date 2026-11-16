import { newDb, DataType } from 'pg-mem';
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from '../src/db/types.js';
import {
  createHuddleTables,
  createUsersTable,
} from '../src/db/migrations/002_huddle_schema.js';
import { createWeeklyAvailabilityTable } from '../src/db/migrations/003_weekly_availability.js';
import { setDb } from '../src/db/database.js';

export async function setupTestDb(): Promise<Kysely<Database>> {
  const mem = newDb({ autoCreateForeignKeyIndices: true });

  mem.public.registerFunction({
    name: 'now',
    returns: DataType.timestamp,
    implementation: () => new Date(),
  });

  mem.public.registerFunction({
    name: 'split_part',
    args: [DataType.text, DataType.text, DataType.integer],
    returns: DataType.text,
    implementation: (value: string, delimiter: string, index: number) =>
      value.split(delimiter)[index - 1] ?? '',
  });

  const pool = mem.adapters.createPg().Pool;
  const testDb = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pool(),
    }),
  });

  await createUsersTable(testDb as never);
  await createHuddleTables(testDb as never);
  await createWeeklyAvailabilityTable(testDb as never);
  setDb(testDb);
  return testDb;
}
