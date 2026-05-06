/**
 * Database migration runner
 *
 * Reads SQL files from be/sql/postgres/ in lexicographic order (001_*, 002_*, …),
 * tracks applied migrations in a `schema_migrations` table, and runs only new
 * files on each startup.
 *
 * Usage (programmatic – called from db.js):
 *   const { runMigrations } = require('./db-migrate');
 *   await runMigrations(pgPool);
 *
 * Usage (CLI – for manual / CI runs):
 *   node db-migrate.js [--dry-run]
 */
const fs = require('fs/promises');
const path = require('path');

const MIGRATIONS_DIR = path.resolve(__dirname, 'sql/postgres');
const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureMigrationsTable(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            filename   text        PRIMARY KEY,
            applied_at timestamptz NOT NULL DEFAULT now()
        )
    `);
}

async function getAppliedMigrations(client) {
    const result = await client.query(
        `SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY filename`
    );
    return new Set(result.rows.map((r) => r.filename));
}

/**
 * Run all pending migrations from the migrations directory.
 * Each SQL file is wrapped in a transaction; if it fails the transaction
 * is rolled back and an error is thrown (halting startup).
 *
 * @param {import('pg').Pool} pool
 * @param {{ dryRun?: boolean }} [opts]
 */
async function runMigrations(pool, opts = {}) {
    const { dryRun = false } = opts;
    const client = await pool.connect();
    try {
        await ensureMigrationsTable(client);
        const applied = await getAppliedMigrations(client);

        const files = await fs.readdir(MIGRATIONS_DIR);
        const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();
        const pending = sqlFiles.filter((f) => !applied.has(f));
        const skipped = sqlFiles.filter((f) => applied.has(f));

        if (skipped.length > 0) {
            console.log(`[migrations] ${skipped.length} already applied: ${skipped.join(', ')}`);
        }

        if (pending.length === 0) {
            console.log('✓ All DB migrations are up to date');
            return;
        }

        console.log(`[migrations] ${pending.length} pending: ${pending.join(', ')}`);

        for (const file of pending) {
            const filePath = path.join(MIGRATIONS_DIR, file);
            const sql = await fs.readFile(filePath, 'utf8');

            if (dryRun) {
                console.log(`[dry-run] Would apply: ${file}`);
                continue;
            }

            // Strip top-level BEGIN/COMMIT from the SQL file so the runner's own
            // transaction wraps everything atomically. Only strip when followed by
            // a semicolon — PL/pgSQL function bodies use bare `begin` (no semicolon)
            // which must be preserved.
            const stripped = sql
                .replace(/^\s*begin\s*;\s*$/gim, '')
                .replace(/^\s*commit\s*;\s*$/gim, '');

            // Migrations marked with `-- atp:no-transaction` must NOT be wrapped
            // in BEGIN/COMMIT (e.g. files that use CREATE INDEX CONCURRENTLY, which
            // is illegal inside a transaction block). Each statement auto-commits.
            const noTransaction = /--\s*atp:no-transaction/i.test(sql);

            if (noTransaction) {
                try {
                    // Use pool.query() so the statements run on a fresh connection
                    // with no active transaction block.
                    await pool.query(stripped);
                    await client.query(
                        `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
                        [file]
                    );
                    console.log(`✓ Migration applied (no-transaction): ${file}`);
                } catch (err) {
                    throw new Error(`Migration failed (${file}): ${err.message}`);
                }
            } else {
                await client.query('BEGIN');
                try {
                    await client.query(stripped);
                    await client.query(
                        `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
                        [file]
                    );
                    await client.query('COMMIT');
                    console.log(`✓ Migration applied: ${file}`);
                } catch (err) {
                    await client.query('ROLLBACK');
                    throw new Error(`Migration failed (${file}): ${err.message}`);
                }
            }
        }
    } finally {
        client.release();
    }
}

// ── CLI entrypoint ──────────────────────────────────────────────────────────
if (require.main === module) {
    const config = require('./config');

    if (config.database.client !== 'postgres') {
        console.error('Migrations are only supported for the postgres client.');
        process.exit(1);
    }

    const { Pool } = require('pg');
    const pool = new Pool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
    });

    const dryRun = process.argv.includes('--dry-run');

    runMigrations(pool, { dryRun })
        .then(async () => {
            await pool.end();
            process.exit(0);
        })
        .catch(async (err) => {
            console.error(err.message);
            await pool.end();
            process.exit(1);
        });
}

module.exports = { runMigrations };
