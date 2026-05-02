require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');

const cliArgs = process.argv.slice(2);
const cliFlags = new Set(cliArgs);

function getArgValue(prefix, fallback = null) {
  const found = cliArgs.find((value) => value.startsWith(prefix));
  if (!found) {
    return fallback;
  }
  return found.slice(prefix.length);
}

function asInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function getPgConfig() {
  return {
    host: process.env.TARGET_PGHOST || process.env.PGHOST || '127.0.0.1',
    port: asInteger(process.env.TARGET_PGPORT || process.env.PGPORT, 5432),
    user: process.env.TARGET_PGUSER || process.env.PGUSER || 'atp_postgres',
    password: process.env.TARGET_PGPASSWORD || process.env.PGPASSWORD || 'atp_postgres_dev',
    database: process.env.TARGET_PGDATABASE || process.env.PGDATABASE || 'allthepreaching',
  };
}

function toPosixRelativePath(fileUrl) {
  if (!fileUrl) {
    return null;
  }

  try {
    const parsed = new URL(fileUrl);
    let pathname = decodeURIComponent(parsed.pathname || '');
    pathname = pathname.replace(/^\/+/, '');
    if (pathname.startsWith('video/')) {
      pathname = pathname.slice('video/'.length);
    }
    return pathname;
  } catch (error) {
    const cleaned = fileUrl.split('?')[0].replace(/^\/+/, '');
    return cleaned.startsWith('video/') ? cleaned.slice('video/'.length) : cleaned;
  }
}

function swapExtension(relativePath, nextExtension) {
  if (!relativePath) {
    return null;
  }
  const extension = path.posix.extname(relativePath);
  if (!extension) {
    return `${relativePath}${nextExtension}`;
  }
  return `${relativePath.slice(0, -extension.length)}${nextExtension}`;
}

function buildSubtitlePaths(videoRow, libraryRoot) {
  const relativeVideoPath = toPosixRelativePath(videoRow.vid_url);
  const subtitleRelativePath = swapExtension(relativeVideoPath, '.vtt');
  const subtitleCandidates = subtitleRelativePath
    ? [
        path.resolve(libraryRoot, ...subtitleRelativePath.split('/')),
        path.resolve(libraryRoot, 'video', ...subtitleRelativePath.split('/')),
        path.resolve(libraryRoot, 'home', 'kjv1611o', 'public_html', 'video', ...subtitleRelativePath.split('/')),
      ]
    : [];

  return {
    relativeVideoPath,
    subtitleRelativePath,
    subtitleCandidates,
  };
}

async function resolveExistingSubtitlePath(subtitleCandidates) {
  for (const candidate of subtitleCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (error) {
      continue;
    }
  }

  return subtitleCandidates[0] || null;
}

function toTimestampSeconds(value) {
  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(`Invalid cue timestamp: ${value}`);
  }

  const padded = parts.length === 2 ? ['0', ...parts] : parts;
  const [hours, minutes, seconds] = padded.map(Number);
  if ([hours, minutes, seconds].some((part) => Number.isNaN(part))) {
    throw new Error(`Invalid cue timestamp: ${value}`);
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function stripCueText(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseVtt(content) {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  const cues = [];
  let cueIndex = 0;

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      continue;
    }

    const first = lines[0].toUpperCase();
    if (first === 'WEBVTT' || first.startsWith('NOTE') || first.startsWith('STYLE') || first.startsWith('REGION')) {
      continue;
    }

    let timestampLineIndex = -1;
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].includes('-->')) {
        timestampLineIndex = index;
        break;
      }
    }

    if (timestampLineIndex === -1) {
      continue;
    }

    const [startRaw] = lines[timestampLineIndex].split('-->');
    const text = stripCueText(lines.slice(timestampLineIndex + 1).join(' '));
    if (!text) {
      continue;
    }

    cues.push({
      cueIndex,
      timestampSeconds: toTimestampSeconds(startRaw),
      text,
    });
    cueIndex += 1;
  }

  return cues;
}

function buildSubtitleDocumentId(subtitlePath, cueIndex, timestampSeconds, text) {
  return crypto
    .createHash('sha256')
    .update(`${subtitlePath}|${cueIndex}|${timestampSeconds}|${text}`)
    .digest('hex');
}

async function computeFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function getVideoDate(videoRow) {
  if (videoRow.published_at) {
    return videoRow.published_at;
  }
  if (videoRow.created_at) {
    return videoRow.created_at;
  }
  return null;
}

async function ensureSchema(client) {
  const schemaPath = path.resolve(__dirname, '../sql/postgres/001_init.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf8');
  await client.query(schemaSql);
}

async function loadVideos(client, options) {
  const where = ['vid_url is not null', "coalesce(vid_url, '') <> ''"];
  const params = [];

  if (options.videoId !== null) {
    where.push('id = $1');
    params.push(options.videoId);
  }

  const sql = `
    select id, vid_url, thumb_url, vid_title, vid_preacher, vid_category, search_category, video_id, language, runtime_minutes, published_at, date, created_at
    from videos
    where ${where.join(' and ')}
    order by id
  `;

  const result = await client.query(sql, params);
  return result.rows;
}

async function getTrackerByVideoId(client, videoPk) {
  const result = await client.query(
    `select * from index_file where video_pk = $1`,
    [videoPk]
  );
  return result.rows[0] || null;
}

async function upsertTracker(client, payload) {
  const result = await client.query(
    `
      insert into index_file (
        video_pk,
        file_path,
        subtitle_path,
        processed,
        file_deleted,
        processing_error,
        file_changed,
        file_hash,
        indexed_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (video_pk) do update
      set
        file_path = excluded.file_path,
        subtitle_path = excluded.subtitle_path,
        processed = excluded.processed,
        file_deleted = excluded.file_deleted,
        processing_error = excluded.processing_error,
        file_changed = excluded.file_changed,
        file_hash = excluded.file_hash,
        indexed_at = excluded.indexed_at
      returning *
    `,
    [
      payload.videoPk,
      payload.filePath,
      payload.subtitlePath,
      payload.processed,
      payload.fileDeleted,
      payload.processingError,
      payload.fileChanged,
      payload.fileHash,
      payload.indexedAt,
    ]
  );
  return result.rows[0];
}

async function replaceDocumentsForVideo(client, trackerId, videoRow, subtitlePath, cues) {
  await client.query('delete from subtitle_documents where video_pk = $1', [videoRow.id]);
  await client.query('delete from index_item where index_file_id = $1', [trackerId]);

  if (cues.length === 0) {
    return;
  }

  const categoryName = videoRow.search_category || null;
  const categoryInfo = [videoRow.search_category, videoRow.vid_title].filter(Boolean).join(' ').trim() || null;
  const videoDate = getVideoDate(videoRow);

  const documentValues = [];
  const documentPlaceholders = cues.map((cue, cueIndex) => {
    const id = buildSubtitleDocumentId(subtitlePath, cue.cueIndex, cue.timestampSeconds, cue.text);
    const row = [
      id,
      videoRow.id,
      subtitlePath,
      cue.cueIndex,
      cue.timestampSeconds,
      cue.text,
      videoRow.vid_title,
      videoRow.vid_preacher,
      categoryName,
      videoRow.vid_category,
      videoRow.vid_url,
      videoRow.thumb_url,
      videoRow.language,
      videoRow.runtime_minutes,
      categoryInfo,
      videoDate,
    ];
    documentValues.push(...row);
    const base = cueIndex * row.length;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16})`;
  });

  await client.query(
    `
      insert into subtitle_documents (
        id,
        video_pk,
        subtitle_path,
        cue_index,
        timestamp_seconds,
        text,
        title,
        author,
        category_name,
        category_slug,
        video_url,
        thumbnail_url,
        language,
        runtime_minutes,
        category_info,
        video_date
      ) values ${documentPlaceholders.join(', ')}
    `,
    documentValues
  );

  const itemValues = [];
  const itemPlaceholders = cues.map((cue, cueIndex) => {
    const documentId = buildSubtitleDocumentId(subtitlePath, cue.cueIndex, cue.timestampSeconds, cue.text);
    itemValues.push(trackerId, documentId);
    const base = cueIndex * 2;
    return `($${base + 1}, $${base + 2})`;
  });

  await client.query(
    `insert into index_item (index_file_id, document_id) values ${itemPlaceholders.join(', ')}`,
    itemValues
  );
}

async function markDeletedFile(client, tracker, reason) {
  await client.query('delete from subtitle_documents where video_pk = $1', [tracker.video_pk]);
  await client.query('delete from index_item where index_file_id = $1', [tracker.id]);
  await upsertTracker(client, {
    videoPk: tracker.video_pk,
    filePath: tracker.file_path,
    subtitlePath: tracker.subtitle_path,
    processed: true,
    fileDeleted: true,
    processingError: reason,
    fileChanged: false,
    fileHash: null,
    indexedAt: new Date().toISOString(),
  });
}

async function cleanupOrphans(client, validVideoIds) {
  const result = await client.query('select * from index_file');
  for (const tracker of result.rows) {
    if (!validVideoIds.has(tracker.video_pk)) {
      await client.query('delete from subtitle_documents where video_pk = $1', [tracker.video_pk]);
      await client.query('delete from index_file where id = $1', [tracker.id]);
    }
  }
}

async function main() {
  const client = new Client(getPgConfig());
  const libraryRoot = getArgValue('--root=', process.env.SUBTITLE_LIBRARY_ROOT || process.env.CADDY_VIDEO_PATH || '/var/videos');
  const videoId = getArgValue('--video-id=', null);
  const dryRun = cliFlags.has('--dry-run');

  await client.connect();

  try {
    await ensureSchema(client);

    const videos = await loadVideos(client, {
      videoId: videoId === null ? null : asInteger(videoId, null),
    });

    console.log(`Loaded ${videos.length} videos for subtitle indexing`);

    const validVideoIds = new Set(videos.map((video) => video.id));
    let indexedCount = 0;
    let skippedCount = 0;
    let deletedCount = 0;

    for (const videoRow of videos) {
      const { subtitleRelativePath, subtitleCandidates } = buildSubtitlePaths(videoRow, libraryRoot);
      const subtitleAbsolutePath = await resolveExistingSubtitlePath(subtitleCandidates);
      if (!subtitleRelativePath || !subtitleAbsolutePath) {
        skippedCount += 1;
        continue;
      }

      const tracker = await getTrackerByVideoId(client, videoRow.id);

      try {
        await fs.access(subtitleAbsolutePath);
      } catch (error) {
        if (tracker) {
          if (!dryRun) {
            await markDeletedFile(client, tracker, 'Subtitle file missing');
          }
          deletedCount += 1;
        } else {
          skippedCount += 1;
        }
        continue;
      }

      const fileHash = await computeFileHash(subtitleAbsolutePath);
      if (tracker && tracker.file_hash === fileHash && !tracker.file_deleted && tracker.processed) {
        skippedCount += 1;
        continue;
      }

      const fileChanged = Boolean(tracker && tracker.file_hash && tracker.file_hash !== fileHash);
      const subtitleContent = await fs.readFile(subtitleAbsolutePath, 'utf8');
      const cues = parseVtt(subtitleContent);

      if (dryRun) {
        console.log(`[dry-run] would index video ${videoRow.id} from ${subtitleAbsolutePath} with ${cues.length} cues`);
        indexedCount += 1;
        continue;
      }

      await client.query('begin');
      try {
        const savedTracker = await upsertTracker(client, {
          videoPk: videoRow.id,
          filePath: subtitleAbsolutePath,
          subtitlePath: subtitleRelativePath,
          processed: false,
          fileDeleted: false,
          processingError: null,
          fileChanged,
          fileHash,
          indexedAt: new Date().toISOString(),
        });

        await replaceDocumentsForVideo(client, savedTracker.id, videoRow, subtitleRelativePath, cues);

        await upsertTracker(client, {
          videoPk: videoRow.id,
          filePath: subtitleAbsolutePath,
          subtitlePath: subtitleRelativePath,
          processed: true,
          fileDeleted: false,
          processingError: null,
          fileChanged: false,
          fileHash,
          indexedAt: new Date().toISOString(),
        });

        await client.query('commit');
        indexedCount += 1;
      } catch (error) {
        await client.query('rollback');
        await upsertTracker(client, {
          videoPk: videoRow.id,
          filePath: subtitleAbsolutePath,
          subtitlePath: subtitleRelativePath,
          processed: true,
          fileDeleted: false,
          processingError: error.message,
          fileChanged,
          fileHash,
          indexedAt: new Date().toISOString(),
        });
        throw error;
      }
    }

    if (!dryRun && videoId === null) {
      await cleanupOrphans(client, validVideoIds);
    }

    console.log(`Subtitle indexing complete. indexed=${indexedCount} skipped=${skippedCount} deleted=${deletedCount}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Subtitle indexing failed:', error.message);
  process.exit(1);
});