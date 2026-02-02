/**
 * Database connection module
 * Handles MariaDB connection via private IP (server-accessible only)
 * Can use mock database for testing when USE_MOCK_DB=true
 */
const config = require('./config');

// Use mock database if flag is set
if (config.database.useMock) {
    console.log('📦 Using MOCK DATABASE for testing');
    module.exports = require('./mockDb');
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
