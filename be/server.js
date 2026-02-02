/**
 * ALLthePREACHING.com Backend Server
 * Express API for video database, RSS feeds, and search
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors(config.cors));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.security.rateLimitWindow,
    max: config.security.rateLimitMax
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/videos', require('./routes/videos'));
app.use('/api/rss', require('./routes/rss'));
app.use('/api/search', require('./routes/search'));
app.use('/api/clone', require('./routes/clone'));
app.use('/api/preachers', require('./routes/preachers'));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});

// Start server
app.listen(config.server.port, () => {
    console.log(`🚀 ALLthePREACHING Backend running on port ${config.server.port}`);
    console.log(`   Environment: ${config.server.env}`);
    console.log(`   CORS Origin: ${config.cors.origin}`);
    console.log(`   Database: ${config.database.host}:${config.database.port}/${config.database.database}`);
    console.log(`   Video Source: ${config.video.source}`);
});

module.exports = app;
