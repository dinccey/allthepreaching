/**
 * Database migration script
 * Consolidates preacher categories and migrates video data
 * 
 * Usage: node migrate.js
 * 
 * This script should be run once before deployment to:
 * 1. Scan Caddy file structure for videos
 * 2. Extract metadata from filenames and existing DB
 * 3. Consolidate vid_category to unified preacher enum
 * 4. Update database records
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const DB_CONFIG = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
};

const CADDY_VIDEO_PATH = process.env.CADDY_VIDEO_PATH || '/var/videos';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log('=== ALLthePREACHING Database Migration ===\n');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

    let connection;

    try {
        // Connect to database
        console.log('Connecting to database...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✓ Connected\n');

        // Step 1: Analyze current categories
        console.log('Step 1: Analyzing current categories...');
        const [categories] = await connection.query(`
      SELECT vid_category, COUNT(*) as count 
      FROM videos 
      GROUP BY vid_category 
      ORDER BY count DESC
    `);

        console.log('Current categories:');
        categories.forEach(cat => {
            console.log(`  - ${cat.vid_category}: ${cat.count} videos`);
        });
        console.log();

        // Step 2: Create preacher mapping
        console.log('Step 2: Creating preacher consolidation map...');
        const [preachers] = await connection.query(`
      SELECT DISTINCT vid_preacher 
      FROM videos 
      ORDER BY vid_preacher
    `);

        console.log(`Found ${preachers.length} unique preachers\n`);

        // Step 3: Consolidate categories to match preachers
        console.log('Step 3: Consolidating categories...');

        // This maps legacy categories to preacher names
        // Customize this based on your actual data
        const categoryMap = {
            // Example mappings (adjust based on your data):
            // 'pastor-anderson': 'Anderson',
            // 'pastor-mejia': 'Mejia',
            // Add more mappings as needed
        };

        let updateCount = 0;

        for (const [oldCategory, preacherName] of Object.entries(categoryMap)) {
            const updateQuery = `
        UPDATE videos 
        SET vid_category = ? 
        WHERE vid_category = ?
      `;

            if (!DRY_RUN) {
                const [result] = await connection.query(updateQuery, [preacherName, oldCategory]);
                updateCount += result.affectedRows;
            } else {
                const [[{ count }]] = await connection.query(
                    'SELECT COUNT(*) as count FROM videos WHERE vid_category = ?',
                    [oldCategory]
                );
                console.log(`  Would update ${count} videos: ${oldCategory} → ${preacherName}`);
            }
        }

        console.log(`${DRY_RUN ? 'Would update' : 'Updated'} ${updateCount} records\n`);

        // Step 4: Scan Caddy directory for new videos
        console.log('Step 4: Scanning Caddy directory for videos...');

        try {
            const videoFiles = await scanVideoDirectory(CADDY_VIDEO_PATH);
            console.log(`Found ${videoFiles.length} video files\n`);

            // Step 5: Import new videos
            console.log('Step 5: Importing new videos...');
            let importedCount = 0;

            for (const file of videoFiles) {
                const metadata = extractMetadata(file);

                // Check if video already exists
                const [[existing]] = await connection.query(
                    'SELECT id FROM videos WHERE vid_url = ?',
                    [file.relativePath]
                );

                if (!existing) {
                    if (!DRY_RUN) {
                        await connection.query(`
              INSERT INTO videos (
                vid_category, vid_preacher, name, vid_title,
                date, vid_url, created_at, shorts, clicks
              ) VALUES (?, ?, ?, ?, ?, ?, NOW(), 0, 0)
            `, [
                            metadata.category,
                            metadata.preacher,
                            metadata.name,
                            metadata.title,
                            metadata.date,
                            file.relativePath
                        ]);
                        importedCount++;
                    } else {
                        console.log(`  Would import: ${metadata.title}`);
                    }
                }
            }

            console.log(`${DRY_RUN ? 'Would import' : 'Imported'} ${importedCount} new videos\n`);
        } catch (err) {
            console.log('⚠ Could not scan Caddy directory (may not be accessible)');
            console.log(`  ${err.message}\n`);
        }

        // Step 6: Generate report
        console.log('Step 6: Generating final report...');
        const [[stats]] = await connection.query(`
      SELECT 
        COUNT(*) as totalVideos,
        COUNT(DISTINCT vid_preacher) as totalPreachers,
        COUNT(DISTINCT vid_category) as totalCategories
      FROM videos
    `);

        console.log('\n=== Migration Summary ===');
        console.log(`Total Videos: ${stats.totalVideos}`);
        console.log(`Total Preachers: ${stats.totalPreachers}`);
        console.log(`Total Categories: ${stats.totalCategories}`);

        if (DRY_RUN) {
            console.log('\n⚠ DRY RUN MODE - No changes were made');
            console.log('Run without --dry-run to apply changes');
        } else {
            console.log('\n✓ Migration completed successfully');
        }

    } catch (error) {
        console.error('\n✗ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

/**
 * Recursively scan directory for video files
 */
async function scanVideoDirectory(dir) {
    const files = [];

    async function scan(currentDir, basePath = '') {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const relativePath = path.join(basePath, entry.name);

            if (entry.isDirectory()) {
                await scan(fullPath, relativePath);
            } else if (entry.isFile() && /\.(mp4|webm|mkv)$/i.test(entry.name)) {
                files.push({
                    fullPath,
                    relativePath,
                    name: entry.name
                });
            }
        }
    }

    await scan(dir);
    return files;
}

/**
 * Extract metadata from filename and path
 */
function extractMetadata(file) {
    // Extract preacher from path (e.g., /pastor-anderson/...)
    const pathParts = file.relativePath.split(path.sep);
    const preacher = pathParts[0] || 'Unknown';

    // Extract title from filename
    const basename = path.basename(file.name, path.extname(file.name));
    const title = basename
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

    // Try to extract date from filename (YYYYMMDD or YYYY-MM-DD)
    const dateMatch = basename.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
    const date = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        : new Date().toISOString().split('T')[0];

    return {
        preacher,
        category: preacher,
        name: basename,
        title,
        date
    };
}

// Run migration
main();
