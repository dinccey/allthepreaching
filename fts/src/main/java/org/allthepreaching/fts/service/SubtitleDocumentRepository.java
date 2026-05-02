package org.allthepreaching.fts.service;

import org.allthepreaching.fts.model.SubtitleCue;
import org.allthepreaching.fts.model.VideoCandidate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Repository
public class SubtitleDocumentRepository {

    private final JdbcTemplate jdbcTemplate;
    private final HashingService hashingService;

    public SubtitleDocumentRepository(JdbcTemplate jdbcTemplate, HashingService hashingService) {
        this.jdbcTemplate = jdbcTemplate;
        this.hashingService = hashingService;
    }

    public void deleteByVideoPk(long videoPk) {
        jdbcTemplate.update("delete from subtitle_documents where video_pk = ?", videoPk);
    }

    public List<String> insertDocuments(VideoCandidate candidate, String subtitleRelativePath, List<SubtitleCue> cues) {
        List<String> documentIds = new ArrayList<>(cues.size());

        jdbcTemplate.batchUpdate(
            """
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
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            cues,
            cues.size(),
            (preparedStatement, cue) -> {
                String documentId = buildDocumentId(subtitleRelativePath, cue);
                documentIds.add(documentId);

                preparedStatement.setString(1, documentId);
                preparedStatement.setLong(2, candidate.videoPk());
                preparedStatement.setString(3, subtitleRelativePath);
                preparedStatement.setInt(4, cue.cueIndex());
                preparedStatement.setDouble(5, cue.timestampSeconds());
                preparedStatement.setString(6, cue.text());
                preparedStatement.setString(7, candidate.title());
                preparedStatement.setString(8, candidate.preacher());
                preparedStatement.setString(9, candidate.categoryName());
                preparedStatement.setString(10, candidate.categorySlug());
                preparedStatement.setString(11, candidate.videoUrl());
                preparedStatement.setString(12, candidate.thumbnailUrl());
                preparedStatement.setString(13, candidate.language());
                preparedStatement.setBigDecimal(14, candidate.runtimeMinutes());
                preparedStatement.setString(15, candidate.categoryInfo());
                Instant videoDate = candidate.resolvedVideoDate();
                preparedStatement.setTimestamp(16, videoDate == null ? null : Timestamp.from(videoDate));
            }
        );

        return documentIds;
    }

    private String buildDocumentId(String subtitleRelativePath, SubtitleCue cue) {
        return hashingService.hashText(
            subtitleRelativePath + "|" + cue.cueIndex() + "|" + cue.timestampSeconds() + "|" + cue.text()
        );
    }
}