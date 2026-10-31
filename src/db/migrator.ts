import { Migrator, type MigrationProvider } from 'kysely';
import { db } from './database.js';
import * as createTables from './migrations/001_create_tables.js';
import { dir } from 'node:console';

const provider: MigrationProvider = {
    async getMigrations() {
        return {
            '001_create_tables': createTables,
        };
    },
};


async function run() {
    const direction = process.argv[2];
    if (direction !== 'up' && direction !== 'down') {
        console.error('Usage: tsx src/db/migrator.ts <up|down>');
        process.exit(1);
    }

    const migrator = new Migrator({db, provider});
    const {error, results} = direction === 'up' ? await migrator.migrateToLatest() : await migrator.migrateDown();

    results?.forEach((r) => console.log(`${r.status}: ${r.migrationName} (${r.direction})`));

    await db.destroy();

    if (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

run();