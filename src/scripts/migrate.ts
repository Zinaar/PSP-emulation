import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import 'dotenv/config';

/**
 * Simple migration runner that executes all SQL files in the migrations directory.
 */
async function runMigrations(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL || 'postgres://psp:psp@localhost:5432/psp';
    const pool = new pg.Pool({ connectionString: databaseUrl });

    try {
        const migrationsDirectory = path.resolve(__dirname, '../../migrations');
        const migrationFiles = fs.readdirSync(migrationsDirectory)
            .filter((fileName) => fileName.endsWith('.sql'))
            .sort();

        for (const fileName of migrationFiles) {
            const sqlContent = fs.readFileSync(path.join(migrationsDirectory, fileName), 'utf-8');
            console.log(`Running migration: ${fileName}`);
            await pool.query(sqlContent);
            console.log(`Completed: ${fileName}`);
        }

        console.log('All migrations completed successfully');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Migration failed: ${errorMessage}`);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations();
