import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './types.js';
import dotenv from 'dotenv';

dotenv.config();

// DATE (OID 1082) as a plain YYYY-MM-DD string, not a local-midnight Date
pg.types.setTypeParser(1082, (value: string) => value);

let _dbInstance: Kysely<Database> | null = null;

export function getDb(): Kysely<Database> {
  if (!_dbInstance) {
    const dialect = new PostgresDialect({
      pool: new pg.Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    });
    _dbInstance = new Kysely<Database>({
      dialect,
    });
  }
  return _dbInstance;
}

export function setDb(customDb: Kysely<Database>): void {
  _dbInstance = customDb;
}

export const db: Kysely<Database> = new Proxy({} as Kysely<Database>, {
  get(_target, prop) {
    const instance = getDb() as any;
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
