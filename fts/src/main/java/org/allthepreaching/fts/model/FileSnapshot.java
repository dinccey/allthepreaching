package org.allthepreaching.fts.model;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

public record FileSnapshot(Path path, long size, Instant modifiedAt) {

    public static FileSnapshot from(Path path) throws IOException {
        return new FileSnapshot(
            path,
            Files.size(path),
            Files.getLastModifiedTime(path).toInstant()
        );
    }
}