package org.allthepreaching.fts.service;

import org.allthepreaching.fts.model.TrackerRecord;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class TrackerRepository {

    private static final String INDEXER_NAME = "subtitle-indexer";

    private final JdbcTemplate jdbcTemplate;

    public TrackerRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public TrackerRecord upsertTracker(
        long videoPk,
        String filePath,
        String subtitlePath,
        boolean processed,
        boolean fileDeleted,
        String processingError,
        boolean fileChanged,
        String fileHash,
        Instant indexedAt,
        Instant fileMtime,
        Long fileSize,
        Instant sourceUpdatedAt,
        Instant lastSeenAt
    ) {
        return jdbcTemplate.queryForObject(
            """
                insert into index_file (
                  video_pk,
                  file_path,
                  subtitle_path,
                  processed,
                  file_deleted,
                  processing_error,
                  file_changed,
                  file_hash,
                  indexed_at,
                  file_mtime,
                  file_size,
                  source_updated_at,
                  last_seen_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict (video_pk) do update
                set
                  file_path = excluded.file_path,
                  subtitle_path = excluded.subtitle_path,
                  processed = excluded.processed,
                  file_deleted = excluded.file_deleted,
                  processing_error = excluded.processing_error,
                  file_changed = excluded.file_changed,
                  file_hash = excluded.file_hash,
                  indexed_at = excluded.indexed_at,
                  file_mtime = excluded.file_mtime,
                  file_size = excluded.file_size,
                  source_updated_at = excluded.source_updated_at,
                  last_seen_at = excluded.last_seen_at
                returning id, video_pk, file_path, subtitle_path, processed, file_deleted, processing_error,
                          file_changed, file_hash, indexed_at, updated_at, file_size, file_mtime,
                          source_updated_at, last_seen_at
            """,
            trackerRowMapper(),
            videoPk,
            filePath,
            subtitlePath,
            processed,
            fileDeleted,
            processingError,
            fileChanged,
            fileHash,
            toTimestamp(indexedAt),
            toTimestamp(fileMtime),
            fileSize,
            toTimestamp(sourceUpdatedAt),
            toTimestamp(lastSeenAt)
        );
    }

    public List<TrackerRecord> findTrackedFilesAfter(long lastTrackerId, int limit) {
        return jdbcTemplate.query(
            """
                select id, video_pk, file_path, subtitle_path, processed, file_deleted, processing_error,
                       file_changed, file_hash, indexed_at, updated_at, file_size, file_mtime,
                       source_updated_at, last_seen_at
                from index_file
                where id > ?
                order by id
                limit ?
            """,
            trackerRowMapper(),
            lastTrackerId,
            limit
        );
    }

    public Optional<TrackerRecord> findTrackerByFilePath(String filePath) {
        List<TrackerRecord> rows = jdbcTemplate.query(
            """
                select id, video_pk, file_path, subtitle_path, processed, file_deleted, processing_error,
                       file_changed, file_hash, indexed_at, updated_at, file_size, file_mtime,
                       source_updated_at, last_seen_at
                from index_file
                where file_path = ?
            """,
            trackerRowMapper(),
            filePath
        );
        return rows.stream().findFirst();
    }

    public List<TrackerRecord> findTrackersForRemovedVideosAfter(long lastTrackerId, int limit) {
        return jdbcTemplate.query(
            """
                select f.id, f.video_pk, f.file_path, f.subtitle_path, f.processed, f.file_deleted, f.processing_error,
                       f.file_changed, f.file_hash, f.indexed_at, f.updated_at, f.file_size, f.file_mtime,
                       f.source_updated_at, f.last_seen_at
                from index_file f
                left join videos v on v.id = f.video_pk
                where f.id > ?
                  and v.id is null
                order by f.id
                limit ?
            """,
            trackerRowMapper(),
            lastTrackerId,
            limit
        );
    }

    public void deleteIndexItems(long trackerId) {
        jdbcTemplate.update("delete from index_item where index_file_id = ?", trackerId);
    }

    public void insertIndexItems(long trackerId, List<String> documentIds) {
        jdbcTemplate.batchUpdate(
            "insert into index_item (index_file_id, document_id) values (?, ?)",
            documentIds,
            documentIds.size(),
            (preparedStatement, documentId) -> {
                preparedStatement.setLong(1, trackerId);
                preparedStatement.setString(2, documentId);
            }
        );
    }

    public void deleteTracker(long trackerId) {
        jdbcTemplate.update("delete from index_file where id = ?", trackerId);
    }

    public void markRunStarted(Instant startedAt) {
        jdbcTemplate.update(
            """
                insert into indexer_state (name, status, last_started_at, updated_at)
                values (?, 'running', ?, now())
                on conflict (name) do update
                set status = 'running',
                    last_started_at = excluded.last_started_at,
                    last_error = null,
                    updated_at = now()
            """,
            INDEXER_NAME,
            toTimestamp(startedAt)
        );
    }

    public void markRunSuccess(Instant finishedAt) {
        jdbcTemplate.update(
            """
                update indexer_state
                set status = 'idle',
                    last_successful_at = ?,
                    last_error = null,
                    updated_at = now()
                where name = ?
            """,
            toTimestamp(finishedAt),
            INDEXER_NAME
        );
    }

    public void markRunFailure(Instant failedAt, String message) {
        jdbcTemplate.update(
            """
                update indexer_state
                set status = 'failed',
                    last_failed_at = ?,
                    last_error = ?,
                    updated_at = now()
                where name = ?
            """,
            toTimestamp(failedAt),
            message,
            INDEXER_NAME
        );
    }

    private RowMapper<TrackerRecord> trackerRowMapper() {
        return (resultSet, rowNum) -> {
            Long fileSize = resultSet.getLong("file_size");
            if (resultSet.wasNull()) {
                fileSize = null;
            }

            return new TrackerRecord(
                resultSet.getLong("id"),
                resultSet.getLong("video_pk"),
                resultSet.getString("file_path"),
                resultSet.getString("subtitle_path"),
                resultSet.getBoolean("processed"),
                resultSet.getBoolean("file_deleted"),
                resultSet.getString("processing_error"),
                resultSet.getBoolean("file_changed"),
                resultSet.getString("file_hash"),
                toInstant(resultSet.getTimestamp("indexed_at")),
                toInstant(resultSet.getTimestamp("updated_at")),
                fileSize,
                toInstant(resultSet.getTimestamp("file_mtime")),
                toInstant(resultSet.getTimestamp("source_updated_at")),
                toInstant(resultSet.getTimestamp("last_seen_at"))
            );
        };
    }

    private Timestamp toTimestamp(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }
}