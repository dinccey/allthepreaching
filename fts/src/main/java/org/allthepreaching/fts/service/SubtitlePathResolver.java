package org.allthepreaching.fts.service;

import org.allthepreaching.fts.config.IndexerProperties;
import org.allthepreaching.fts.model.ResolvedSubtitlePath;
import org.springframework.stereotype.Service;

import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;

@Service
public class SubtitlePathResolver {

    private final IndexerProperties properties;

    public SubtitlePathResolver(IndexerProperties properties) {
        this.properties = properties;
    }

    public ResolvedSubtitlePath resolve(String videoUrl) {
        String relativeVideoPath = toPosixRelativePath(videoUrl);
        if (relativeVideoPath == null || relativeVideoPath.isBlank()) {
            return null;
        }

        String subtitleRelativePath = swapExtension(relativeVideoPath, ".vtt");
        Path root = Path.of(properties.getSubtitleRoot());
        List<Path> candidates = List.of(
            root.resolve(Path.of(subtitleRelativePath)),
            root.resolve("video").resolve(Path.of(subtitleRelativePath)),
            root.resolve("home").resolve("kjv1611o").resolve("public_html").resolve("video").resolve(Path.of(subtitleRelativePath))
        );

        for (Path candidate : candidates) {
            if (candidate.toFile().exists()) {
                return new ResolvedSubtitlePath(subtitleRelativePath, candidate);
            }
        }

        return new ResolvedSubtitlePath(subtitleRelativePath, candidates.get(0));
    }

    private String toPosixRelativePath(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return null;
        }

        String trimmed = fileUrl.trim();
        if ("null".equalsIgnoreCase(trimmed) || "undefined".equalsIgnoreCase(trimmed)) {
            return null;
        }

        try {
            URL parsed = new URL(trimmed);
            String pathname = URLDecoder.decode(parsed.getPath(), StandardCharsets.UTF_8).replaceFirst("^/+", "");
            if (pathname.isBlank() || "null".equalsIgnoreCase(pathname)) {
                return null;
            }
            return pathname.startsWith("video/") ? pathname.substring("video/".length()) : pathname;
        } catch (Exception exception) {
            String cleaned = trimmed.split("\\?")[0].replaceFirst("^/+", "");
            if (cleaned.isBlank() || "null".equalsIgnoreCase(cleaned)) {
                return null;
            }
            return cleaned.startsWith("video/") ? cleaned.substring("video/".length()) : cleaned;
        }
    }

    private String swapExtension(String relativePath, String extension) {
        int dotIndex = relativePath.lastIndexOf('.');
        if (dotIndex < 0) {
            return relativePath + extension;
        }
        return relativePath.substring(0, dotIndex) + extension;
    }
}