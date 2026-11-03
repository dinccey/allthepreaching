/**
 * Schema migrations, run by node-pg-migrate over be/sql/postgres/*.sql.
 *
 * The library owns everything that a hand-written runner gets wrong: which
 * migrations are already applied (history table `pgmigrations`), the advisory
 * lock that stops two processes applying DDL at once, per-migration
 * transactions, and dry runs that execute inside a read-only transaction.
 *
 * Programmatic (db.js startup, and both ingest scripts):
 *   const { runMigrations } = require('./db-migrate');
 *   await runMigrations(pool);        // pg.Pool — one client borrowed
 *   await runMigrations(client);      // connected pg.Client — used as-is
 *
 * CLI (connection comes from ./config, i.e. the same env vars as the app):
 *   node db-migrate.js                     apply pending
 *   node db-migrate.js --status            list pending, exit 1 if any (CI gate)
 *   node db-migrate.js --dry-run           print the SQL, change nothing
 *   node db-migrate.js --fake --count=5    record pending as applied, run nothing
 *
 * There is no down path: the .sql files carry no `-- Down Migration` sections.
 * Roll a mistake forward with a new file instead.
 */
const path = require('path');
const { Pool } = require('pg');
const { runner } = require('node-pg-migrate');

const MIGRATIONS_DIR = path.resolve(__dirname, 'sql/postgres');
const MIGRATIONS_TABLE = 'pgmigrations';

function isPool(db) {
    return db instanceof Pool;
}

/**
 * @param {import('pg').Pool|import('pg').Client} db
 * @param {{ dryRun?: boolean, fake?: boolean, count?: number, direction?: 'up'|'down' }} [opts]
 */
async function runMigrations(db, opts = {}) {
    const { dryRun = false, fake = false, count, direction = 'up' } = opts;
    const borrowed = isPool(db) ? await db.connect() : db;
    try {
        return await runner({
            dbClient: borrowed,
            dir: MIGRATIONS_DIR,
            migrationsTable: MIGRATIONS_TABLE,
            direction,
            dryRun,
            fake,
            ...(count === undefined ? {} : { count }),
        });
    } finally {
        if (isPool(db)) borrowed.release();
    }
}

/**
 * Which migrations are pending, without applying any of them.
 *
 * A dry run executes inside a `BEGIN; SET TRANSACTION READ ONLY` session and takes
 * no advisory lock, so the list is produced by the same resolution a real run uses
 * while being unable to write — safe against a live primary.
 *
 * @param {import('pg').Pool|import('pg').Client} db
 * @returns {Promise<Array<{ name: string, path: string }>>}
 */
async function pendingMigrations(db) {
    return runMigrations(db, { dryRun: true });
}

// ── CLI entrypoint ──────────────────────────────────────────────────────────
if (require.main === module) {
    const config = require('./config');

    if (config.database.client !== 'postgres') {
        console.error('Migrations are only supported for the postgres client.');
        process.exit(1);
    }

    const { Client } = require('pg');
    const args = process.argv.slice(2);
    const flagValue = (name) => {
        const hit = args.find((a) => a.startsWith(`--${name}=`));
        return hit ? Number(hit.slice(name.length + 3)) : undefined;
    };

    const dryRun = args.includes('--dry-run');
    const fake = args.includes('--fake');
    const status = args.includes('--status');
    const count = flagValue('count');

    const client = new Client({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
    });

    client
        .connect()
        .then(() =>
            status
                ? pendingMigrations(client).then((rows) => {
                      if (rows.length === 0) {
                          console.log('✓ schema is up to date');
                          return;
                      }
                      console.log(`${rows.length} migration(s) pending:`);
                      for (const row of rows) console.log(`  ${row.name}`);
                      throw new Error('pending migrations');
                  })
                : runMigrations(client, { dryRun, fake, count }),
        )
        .then(async () => {
            await client.end();
            process.exit(0);
        })
        .catch(async (err) => {
            console.error(err.message);
            await client.end().catch(() => {});
            process.exit(1);
        });
}

module.exports = { runMigrations, pendingMigrations, MIGRATIONS_DIR, MIGRATIONS_TABLE };
