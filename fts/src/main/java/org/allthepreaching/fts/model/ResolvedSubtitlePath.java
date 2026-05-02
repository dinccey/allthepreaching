package org.allthepreaching.fts.model;

import java.nio.file.Path;

public record ResolvedSubtitlePath(String relativePath, Path absolutePath) {
}