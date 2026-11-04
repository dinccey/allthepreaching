/**
 * Schema migrations, run by node-pg-migrate over the files in be/sql/postgres/.
 *
 * The library owns everything a hand-written runner gets wrong: which migrations
 * are already applied (history table `pgmigrations`), per-migration transactions,
 * dry runs that execute inside a read-only transaction, and an advisory lock that
 * refuses a second concurrent runner instead of letting two processes interleave
 * DDL. Verified behaviour of that lock on 9.0.0: it is `pg_try_advisory_lock` in
 * mode 'fail', so the loser exits in ~0.1s with "Another migration is already
 * running" rather than queueing. The API default is left alone for operators, and
 * db.js asks for 'wait' so a rolling restart does not crash-loop the loser.
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
 * There is no down path: the migration files carry no `-- Down Migration` sections.
 * Roll a mistake forward with a new file instead.
 */
const path = require('path');
const { Pool } = require('pg');
const { runner } = require('node-pg-migrate');

const MIGRATIONS_DIR = path.resolve(__dirname, 'sql/postgres');
const MIGRATIONS_TABLE = 'pgmigrations';

// How long a migration may wait for a lock before giving up. Waiting is not free on
// a live site: while a migration queues for ACCESS EXCLUSIVE, every write behind it
// queues too. This is what made `drop trigger ... on videos` fail in 22s against
// production instead of stalling the play counter writes. Advisory lock waits share
// the same GUC, so it also bounds how long 'wait' mode can park a starting container.
const DEFAULT_LOCK_TIMEOUT = process.env.DB_MIGRATION_LOCK_TIMEOUT || '15s';

function isPool(db) {
    return db instanceof Pool;
}

/**
 * @param {import('pg').Pool|import('pg').Client} db
 * @param {{ dryRun?: boolean, fake?: boolean, count?: number, direction?: 'up'|'down',
 *           advisoryLockMode?: 'fail'|'wait', lockTimeout?: string|false }} [opts]
 */
async function runMigrations(db, opts = {}) {
    const {
        dryRun = false,
        fake = false,
        count,
        direction = 'up',
        advisoryLockMode = 'fail',
        lockTimeout = DEFAULT_LOCK_TIMEOUT,
    } = opts;
    const borrowed = isPool(db) ? await db.connect() : db;
    try {
        if (lockTimeout) {
            // set_config, because `set lock_timeout = $1` is a syntax error — GUC
            // values are not bindable in that form.
            await borrowed.query("select set_config('lock_timeout', $1, false)", [lockTimeout]);
        }
        return await runner({
            dbClient: borrowed,
            dir: MIGRATIONS_DIR,
            migrationsTable: MIGRATIONS_TABLE,
            direction,
            dryRun,
            fake,
            count,
            advisoryLockMode,
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
