/**
 * Database connection module
 * Handles MariaDB connection via private IP (server-accessible only)
 * Can use mock database for testing when USE_MOCK_DB=true
 */
const config = require('./config');
const { runMigrations } = require('./db-migrate');

const isPostgres = config.database.client === 'postgres';

function stripMySqlHints(sql) {
    return sql.replace(/\/\*\+\s*MAX_EXECUTION_TIME\(\d+\)\s*\*\//g, '').replace(/\s+/g, ' ').trim();
}

function convertPlaceholders(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => {
        index += 1;
        return `$${index}`;
    });
}

// Use mock database if flag is set
if (config.database.useMock) {
    console.log('📦 Using MOCK DATABASE for testing');
    module.exports = require('./mockDb');
} else {
    if (isPostgres) {
        const { Pool } = require('pg');

        const pool = new Pool({
            host: config.database.host,
            port: config.database.port,
            user: config.database.user,
            password: config.database.password,
            database: config.database.database,
            max: config.database.connectionLimit,
            keepAlive: true,
        });

        // Transient error codes that are safe to retry (DB starting up / recovering).
        const RETRYABLE_PG_CODES = new Set([
            '57P03', // cannot connect now (startup / recovery not yet complete)
            '08006', // connection failure
            '08001', // unable to establish connection
            '08004', // rejected connection
        ]);
        const RETRYABLE_SYSCALL_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE']);

        function isTransient(err) {
            if (!err) return false;
            if (RETRYABLE_PG_CODES.has(err.code)) return true;
            if (RETRYABLE_SYSCALL_CODES.has(err.code)) return true;
            // Only retry startup/connection errors — NOT query timeouts or statement cancellations.
            // 'Query read timeout' (pg client-side) and 'canceling statement due to statement timeout'
            // (pg error code 57014) are NOT transient and should not be retried.
            if (typeof err.message === 'string') {
                const msg = err.message;
                if (/not yet accepting/i.test(msg)) return true;
                if (/connection.*(refused|reset|closed|lost)/i.test(msg)) return true;
            }
            return false;
        }

        async function queryWithRetry(input, params = [], maxAttempts = 4) {
            const sql = typeof input === 'string' ? input : input.sql;
            const timeout = typeof input === 'object' ? input.timeout : undefined;
            const normalizedSql = convertPlaceholders(stripMySqlHints(sql));

            let lastErr;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const result = await pool.query({
                        text: normalizedSql,
                        values: params,
                        query_timeout: timeout,
                    });
                    if (result.command === 'SELECT') {
                        return [result.rows];
                    }
                    return [{ affectedRows: result.rowCount, rows: result.rows }];
                } catch (err) {
                    lastErr = err;
                    if (!isTransient(err) || attempt === maxAttempts) throw err;
                    const delayMs = Math.min(500 * 2 ** (attempt - 1), 8000); // 500 → 1000 → 2000 → 4000 ms
                    console.warn(`[db] transient error (${err.code || err.message}), retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})`);
                    await new Promise(r => setTimeout(r, delayMs));
                }
            }
            throw lastErr;
        }

        const postgresAdapter = {
            query: queryWithRetry,
            async end() {
                await pool.end();
            },
        };

        postgresAdapter.ready = (async () => {
            // Wait for Postgres to become ready (it may still be in recovery on container start).
            const maxStartupAttempts = 20;
            for (let i = 1; i <= maxStartupAttempts; i++) {
                try {
                    await pool.query('select 1 as ok');
                    break;
                } catch (err) {
                    if (!isTransient(err) || i === maxStartupAttempts) throw err;
                    const delayMs = Math.min(1000 * i, 10000);
                    console.warn(`[db] waiting for Postgres (${err.code || err.message}), retry ${i}/${maxStartupAttempts} in ${delayMs}ms`);
                    await new Promise(r => setTimeout(r, delayMs));
                }
            }
            await runMigrations(pool);
            console.log('✓ Postgres connected successfully');
        })().catch((err) => {
            console.error('✗ Postgres startup failed:', err.message);
            process.exit(1);
        });

        module.exports = postgresAdapter;
    } else {
        const mysql = require('mysql2/promise');

        const pool = mysql.createPool({
            host: config.database.host,
            port: config.database.port,
            user: config.database.user,
            password: config.database.password,
            database: config.database.database,
            waitForConnections: true,
            connectionLimit: config.database.connectionLimit,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });

        pool.ready = pool.getConnection()
            .then(connection => {
                console.log('✓ Database connected successfully');
                connection.release();
            })
            .catch(err => {
                console.error('✗ Database connection failed:', err.message);
                process.exit(1);
            });

        module.exports = pool;
    }
}
