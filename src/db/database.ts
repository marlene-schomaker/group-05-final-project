import {Pool} from 'pg'
import {Kysely, PostgresDialect} from 'kysely';
import { Database } from './types';
import dotenv from 'dotenv';

dotenv.config();

const dialect = new PostgresDialect({
    pool: new Pool({
        connectionString: process.env.DATABASE_URL,
    }),
});

export const db = new Kysely<Database>({
    dialect,
});