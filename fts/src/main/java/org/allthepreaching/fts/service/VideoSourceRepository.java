package org.allthepreaching.fts.service;

import org.allthepreaching.fts.model.TrackerRecord;
import org.allthepreaching.fts.model.VideoCandidate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public class VideoSourceRepository {

    private final JdbcTemplate jdbcTemplate;

    public VideoSourceRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<VideoCandidate> findCandidatesAfter(long lastVideoPk, int limit) {
        return jdbcTemplate.query(
            """
                select
                  v.id,
                  v.vid_url,
                  v.thumb_url,
                  v.vid_title,
                  v.vid_preacher,
                  v.vid_category,
                  v.search_category,
                  v.video_id,
                  v.language,
                  v.runtime_minutes,
                  v.created_at,
                  v.updated_at,
                  v.published_at,
                  f.id as tracker_id,
                  f.file_path,
                  f.subtitle_path,
                  f.processed,
                  f.file_deleted,
                  f.processing_error,
                  f.file_changed,
                  f.file_hash,
                  f.indexed_at,
                  f.updated_at as tracker_updated_at,
                  f.file_size,
                  f.file_mtime,
                  f.source_updated_at,
                  f.last_seen_at
                from videos v
                left join index_file f on f.video_pk = v.id
                where v.id > ?
                  and (
                    f.id is null
                    or coalesce(f.processed, false) = false
                                        or coalesce(f.file_deleted, false) = true
                    or v.updated_at > coalesce(f.source_updated_at, to_timestamp(0))
                  )
                order by v.id
                limit ?
            """,
            candidateRowMapper(),
            lastVideoPk,
            limit
        );
    }

    public Optional<VideoCandidate> findVideoById(long videoPk) {
        List<VideoCandidate> rows = jdbcTemplate.query(
            """
                select
                  v.id,
                  v.vid_url,
                  v.thumb_url,
                  v.vid_title,
                  v.vid_preacher,
                  v.vid_category,
                  v.search_category,
                  v.video_id,
                  v.language,
                  v.runtime_minutes,
                  v.created_at,
                  v.updated_at,
                  v.published_at,
                  f.id as tracker_id,
                  f.file_path,
                  f.subtitle_path,
                  f.processed,
                  f.file_deleted,
                  f.processing_error,
                  f.file_changed,
                  f.file_hash,
                  f.indexed_at,
                  f.updated_at as tracker_updated_at,
                  f.file_size,
                  f.file_mtime,
                  f.source_updated_at,
                  f.last_seen_at
                from videos v
                left join index_file f on f.video_pk = v.id
                where v.id = ?
            """,
            candidateRowMapper(),
            videoPk
        );
        return rows.stream().findFirst();
    }

        public Optional<VideoCandidate> findPendingVideoById(long videoPk) {
                List<VideoCandidate> rows = jdbcTemplate.query(
                        """
                                select
                                    v.id,
                                    v.vid_url,
                                    v.thumb_url,
                                    v.vid_title,
                                    v.vid_preacher,
                                    v.vid_category,
                                    v.search_category,
                                    v.video_id,
                                    v.language,
                                    v.runtime_minutes,
                                    v.created_at,
                                    v.updated_at,
                                    v.published_at,
                                    f.id as tracker_id,
                                    f.file_path,
                                    f.subtitle_path,
                                    f.processed,
                                    f.file_deleted,
                                    f.processing_error,
                                    f.file_changed,
                                    f.file_hash,
                                    f.indexed_at,
                                    f.updated_at as tracker_updated_at,
                                    f.file_size,
                                    f.file_mtime,
                                    f.source_updated_at,
                                    f.last_seen_at
                                from videos v
                                left join index_file f on f.video_pk = v.id
                                where v.id = ?
                                    and (
                                        f.id is null
                                        or coalesce(f.processed, false) = false
                                        or coalesce(f.file_deleted, false) = true
                                        or v.updated_at > coalesce(f.source_updated_at, to_timestamp(0))
                                    )
                        """,
                        candidateRowMapper(),
                        videoPk
                );
                return rows.stream().findFirst();
        }

    private RowMapper<VideoCandidate> candidateRowMapper() {
        return (resultSet, rowNum) -> new VideoCandidate(
            resultSet.getLong("id"),
            resultSet.getString("vid_url"),
            resultSet.getString("thumb_url"),
            resultSet.getString("vid_title"),
            resultSet.getString("vid_preacher"),
            resultSet.getString("vid_category"),
            resultSet.getString("search_category"),
            resultSet.getString("video_id"),
            resultSet.getString("language"),
            resultSet.getBigDecimal("runtime_minutes"),
            toInstant(resultSet.getTimestamp("created_at")),
            toInstant(resultSet.getTimestamp("updated_at")),
            toLocalDate(resultSet.getDate("published_at")),
            mapTracker(resultSet)
        );
    }

    private TrackerRecord mapTracker(ResultSet resultSet) throws SQLException {
        long trackerId = resultSet.getLong("tracker_id");
        if (resultSet.wasNull()) {
            return null;
        }

        Long fileSize = resultSet.getLong("file_size");
        if (resultSet.wasNull()) {
            fileSize = null;
        }

        return new TrackerRecord(
            trackerId,
            resultSet.getLong("id"),
            resultSet.getString("file_path"),
            resultSet.getString("subtitle_path"),
            resultSet.getBoolean("processed"),
            resultSet.getBoolean("file_deleted"),
            resultSet.getString("processing_error"),
            resultSet.getBoolean("file_changed"),
            resultSet.getString("file_hash"),
            toInstant(resultSet.getTimestamp("indexed_at")),
            toInstant(resultSet.getTimestamp("tracker_updated_at")),
            fileSize,
            toInstant(resultSet.getTimestamp("file_mtime")),
            toInstant(resultSet.getTimestamp("source_updated_at")),
            toInstant(resultSet.getTimestamp("last_seen_at"))
        );
    }

    private Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private LocalDate toLocalDate(Date date) {
        return date == null ? null : date.toLocalDate();
    }
}