require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
const { Client } = require('pg');

const DEFAULT_BATCH_SIZE = 500;
const cliArgs = process.argv.slice(2);
const cliFlags = new Set(cliArgs);

function getArgValue(prefix, fallback) {
  const match = cliArgs.find((value) => value.startsWith(prefix));
  if (!match) {
    return fallback;
  }

  return match.slice(prefix.length);
}

function asInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function buildSourceConfig() {
  return {
    host: process.env.SOURCE_DB_HOST || process.env.DB_HOST,
    port: asInteger(process.env.SOURCE_DB_PORT || process.env.DB_PORT, 3306),
    user: process.env.SOURCE_DB_USER || process.env.DB_USER,
    password: process.env.SOURCE_DB_PASS || process.env.DB_PASS,
    database: process.env.SOURCE_DB_NAME || process.env.DB_NAME,
  };
}

function buildTargetConfig() {
  return {
    host: process.env.TARGET_PGHOST || process.env.PGHOST || '127.0.0.1',
    port: asInteger(process.env.TARGET_PGPORT || process.env.PGPORT, 5432),
    user: process.env.TARGET_PGUSER || process.env.PGUSER || 'atp_postgres',
    password: process.env.TARGET_PGPASSWORD || process.env.PGPASSWORD || 'atp_postgres_dev',
    database: process.env.TARGET_PGDATABASE || process.env.PGDATABASE || 'allthepreaching',
  };
}

function validateSourceConfig(sourceConfig) {
  const missing = ['host', 'user', 'database'].filter((field) => !sourceConfig[field]);
  if (missing.length > 0) {
    throw new Error(`Missing MariaDB source configuration: ${missing.join(', ')}`);
  }
}

function parsePublishedAt(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return null;
  }

  const value = rawValue.trim();
  if (!value) {
    return null;
  }

   if (/^0{4}-0{2}-0{2}$/.test(value) || /^0{8}$/.test(value)) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function parseTimestamp(rawValue) {
  if (!rawValue) {
    return new Date().toISOString();
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function normalizeVideoRow(row) {
  return {
    id: row.id,
    vid_category: row.vid_category,
    search_category: row.search_category,
    vid_preacher: row.vid_preacher,
    name: row.name,
    vid_title: row.vid_title,
    vid_code: row.vid_code,
    date: row.date,
    published_at: parsePublishedAt(row.date),
    vid_url: row.vid_url,
    thumb_url: row.thumb_url,
    pic_url: row.pic_url,
    header_url: row.header_url,
    video_id: row.video_id,
    profile_id: row.profile_id,
    main_category: row.main_category,
    created_at: parseTimestamp(row.created_at),
    updated_at: parseTimestamp(row.created_at),
    clicks: Number(row.clicks || 0),
    shorts: Boolean(row.shorts),
    language: row.language || 'en',
    runtime_minutes: row.runtime_minutes,
  };
}

function normalizeDocsUploadRow(row) {
  return {
    id: row.id,
    name: row.name,
    link: row.link,
    code: row.code,
  };
}

function buildInsertStatement(tableName, columns, rows, conflictKey) {
  const values = [];

  const placeholders = rows.map((row, rowIndex) => {
    const tuple = columns.map((column, columnIndex) => {
      values.push(row[column]);
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    });
    return `(${tuple.join(', ')})`;
  });

  const assignments = columns
    .filter((column) => column !== conflictKey)
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');

  return {
    sql: `
      insert into ${tableName} (${columns.join(', ')})
      values ${placeholders.join(', ')}
      on conflict (${conflictKey}) do update
      set ${assignments}
    `,
    values,
  };
}

async function runSchemaInit(targetClient) {
  const schemaPath = path.resolve(__dirname, '../sql/postgres/001_init.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf8');
  await targetClient.query(schemaSql);
}

async function truncateTargets(targetClient, includeDocs) {
  await targetClient.query('truncate table videos');
  if (includeDocs) {
    await targetClient.query('truncate table docs_upload');
  }
}

async function importTable(options) {
  const {
    sourceConnection,
    targetClient,
    sourceTable,
    sourceQuery,
    countQuery,
    targetTable,
    columns,
    normalizeRow,
    batchSize,
  } = options;

  const [[countRow]] = await sourceConnection.query(countQuery);
  const totalRows = Number(countRow.total_rows || 0);

  console.log(`Importing ${sourceTable}: ${totalRows} rows`);

  for (let offset = 0; offset < totalRows; offset += batchSize) {
    const [sourceRows] = await sourceConnection.query(sourceQuery, [batchSize, offset]);
    const normalizedRows = sourceRows.map(normalizeRow);

    if (normalizedRows.length === 0) {
      continue;
    }

    const statement = buildInsertStatement(targetTable, columns, normalizedRows, 'id');
    await targetClient.query(statement.sql, statement.values);
    console.log(`  ${sourceTable}: ${Math.min(offset + normalizedRows.length, totalRows)}/${totalRows}`);
  }

  const result = await targetClient.query(`select count(*)::int as total_rows from ${targetTable}`);
  console.log(`Finished ${sourceTable}: target has ${result.rows[0].total_rows} rows`);
}

async function main() {
  const initOnly = cliFlags.has('--init-only');
  const importDocs = cliFlags.has('--import-docs');
  const truncateFirst = cliFlags.has('--truncate');
  const batchSize = asInteger(getArgValue('--batch-size=', String(DEFAULT_BATCH_SIZE)), DEFAULT_BATCH_SIZE);

  const sourceConfig = buildSourceConfig();
  const targetConfig = buildTargetConfig();

  if (!initOnly) {
    validateSourceConfig(sourceConfig);
  }

  console.log('=== MariaDB -> Postgres migration ===');
  console.log(`Target Postgres: ${targetConfig.host}:${targetConfig.port}/${targetConfig.database}`);
  console.log(`Mode: ${initOnly ? 'init-only' : 'schema + import'}`);
  console.log(`Batch size: ${batchSize}`);

  const targetClient = new Client(targetConfig);
  await targetClient.connect();

  let sourceConnection;

  try {
    await runSchemaInit(targetClient);
    console.log('Schema initialized successfully');

    if (initOnly) {
      return;
    }

    sourceConnection = await mysql.createConnection(sourceConfig);
    console.log(`Connected to MariaDB source: ${sourceConfig.host}:${sourceConfig.port}/${sourceConfig.database}`);

    if (truncateFirst) {
      await truncateTargets(targetClient, importDocs);
      console.log('Target tables truncated before import');
    }

    await importTable({
      sourceConnection,
      targetClient,
      sourceTable: 'videos',
      sourceQuery: `
        select
          id,
          vid_category,
          search_category,
          vid_preacher,
          name,
          vid_title,
          vid_code,
          date,
          vid_url,
          thumb_url,
          pic_url,
          header_url,
          video_id,
          profile_id,
          main_category,
          created_at,
          clicks,
          shorts,
          language,
          runtime_minutes
        from videos
        order by id
        limit ? offset ?
      `,
      countQuery: 'select count(*) as total_rows from videos',
      targetTable: 'videos',
      columns: [
        'id',
        'vid_category',
        'search_category',
        'vid_preacher',
        'name',
        'vid_title',
        'vid_code',
        'date',
        'published_at',
        'vid_url',
        'thumb_url',
        'pic_url',
        'header_url',
        'video_id',
        'profile_id',
        'main_category',
        'created_at',
        'updated_at',
        'clicks',
        'shorts',
        'language',
        'runtime_minutes',
      ],
      normalizeRow: normalizeVideoRow,
      batchSize,
    });

    if (importDocs) {
      await importTable({
        sourceConnection,
        targetClient,
        sourceTable: 'docsUpload',
        sourceQuery: `
          select id, name, link, code
          from docsUpload
          order by id
          limit ? offset ?
        `,
        countQuery: 'select count(*) as total_rows from docsUpload',
        targetTable: 'docs_upload',
        columns: ['id', 'name', 'link', 'code'],
        normalizeRow: normalizeDocsUploadRow,
        batchSize,
      });
    }

    const invalidDatesResult = await targetClient.query(
      'select count(*)::int as total_rows from videos where date is not null and published_at is null'
    );
    console.log(`Rows with preserved raw date only: ${invalidDatesResult.rows[0].total_rows}`);
    console.log('Migration import completed successfully');
  } finally {
    if (sourceConnection) {
      await sourceConnection.end();
    }
    await targetClient.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});