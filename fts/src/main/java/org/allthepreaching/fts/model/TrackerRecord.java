package org.allthepreaching.fts.model;

import java.nio.file.Path;
import java.time.Instant;
import java.util.Objects;

public record TrackerRecord(
    long trackerId,
    long videoPk,
    String filePath,
    String subtitlePath,
    boolean processed,
    boolean fileDeleted,
    String processingError,
    boolean fileChanged,
    String fileHash,
    Instant indexedAt,
    Instant updatedAt,
    Long fileSize,
    Instant fileMtime,
    Instant sourceUpdatedAt,
    Instant lastSeenAt
) {

    public boolean matches(Path candidatePath, FileSnapshot snapshot) {
        return Objects.equals(filePath, candidatePath.toString())
            && Objects.equals(fileSize, snapshot.size())
            && Objects.equals(fileMtime, snapshot.modifiedAt());
    }
}