package org.allthepreaching.fts.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

public record VideoCandidate(
    long videoPk,
    String videoUrl,
    String thumbnailUrl,
    String title,
    String preacher,
    String categorySlug,
    String categoryName,
    String videoId,
    String language,
    BigDecimal runtimeMinutes,
    Instant createdAt,
    Instant updatedAt,
    LocalDate publishedAt,
    TrackerRecord tracker
) {

    public Instant resolvedVideoDate() {
        if (publishedAt != null) {
            return publishedAt.atStartOfDay().toInstant(ZoneOffset.UTC);
        }
        return createdAt;
    }

    public String categoryInfo() {
        if (categoryName == null || categoryName.isBlank()) {
            return title;
        }
        return categoryName + " " + title;
    }
}