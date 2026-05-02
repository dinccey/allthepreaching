/**
 * Database connection module
 * Handles MariaDB connection via private IP (server-accessible only)
 * Can use mock database for testing when USE_MOCK_DB=true
 */
const config = require('./config');

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

        const postgresAdapter = {
            async query(input, params = []) {
                const sql = typeof input === 'string' ? input : input.sql;
                const timeout = typeof input === 'object' ? input.timeout : undefined;
                const normalizedSql = convertPlaceholders(stripMySqlHints(sql));
                const result = await pool.query({
                    text: normalizedSql,
                    values: params,
                    query_timeout: timeout,
                });

                if (result.command === 'SELECT') {
                    return [result.rows];
                }

                return [{
                    affectedRows: result.rowCount,
                    rows: result.rows,
                }];
            },
            async end() {
                await pool.end();
            },
        };

        pool.query('select 1 as ok')
            .then(() => {
                console.log('✓ Postgres connected successfully');
            })
            .catch((err) => {
                console.error('✗ Postgres connection failed:', err.message);
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

        // Test connection on startup
        pool.getConnection()
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
