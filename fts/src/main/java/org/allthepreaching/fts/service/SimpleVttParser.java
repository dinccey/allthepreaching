package org.allthepreaching.fts.service;

import org.allthepreaching.fts.model.SubtitleCue;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Service
public class SimpleVttParser {

    public List<SubtitleCue> parse(Path path) throws IOException {
        String content = Files.readString(path, StandardCharsets.UTF_8)
            .replace("\uFEFF", "")
            .replace("\r\n", "\n");

        String[] blocks = content.split("\\n\\s*\\n");
        List<SubtitleCue> cues = new ArrayList<>();
        int cueIndex = 0;

        for (String block : blocks) {
            String[] rawLines = block.split("\n");
            List<String> lines = new ArrayList<>();
            for (String rawLine : rawLines) {
                String trimmed = rawLine.trim();
                if (!trimmed.isEmpty()) {
                    lines.add(trimmed);
                }
            }

            if (lines.isEmpty()) {
                continue;
            }

            String first = lines.get(0).toUpperCase();
            if ("WEBVTT".equals(first) || first.startsWith("NOTE") || first.startsWith("STYLE") || first.startsWith("REGION")) {
                continue;
            }

            int timestampLineIndex = -1;
            for (int index = 0; index < lines.size(); index += 1) {
                if (lines.get(index).contains("-->")) {
                    timestampLineIndex = index;
                    break;
                }
            }

            if (timestampLineIndex < 0) {
                continue;
            }

            String[] timestamps = lines.get(timestampLineIndex).split("-->");
            if (timestamps.length < 1) {
                continue;
            }

            String text = sanitizeText(String.join(" ", lines.subList(timestampLineIndex + 1, lines.size())));
            if (text.isBlank()) {
                continue;
            }

            cues.add(new SubtitleCue(cueIndex, parseTimestampSeconds(timestamps[0]), text));
            cueIndex += 1;
        }

        return cues;
    }

    private String sanitizeText(String value) {
        return value
            .replaceAll("<[^>]+>", " ")
            .replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replaceAll("\\s+", " ")
            .trim();
    }

    private double parseTimestampSeconds(String value) {
        String normalized = value.trim().replace(',', '.');
        String[] parts = normalized.split(":");
        if (parts.length < 2 || parts.length > 3) {
            throw new IllegalArgumentException("Invalid cue timestamp: " + value);
        }

        String[] padded = parts.length == 2
            ? new String[] {"0", parts[0], parts[1]}
            : parts;

        double hours = Double.parseDouble(padded[0]);
        double minutes = Double.parseDouble(padded[1]);
        double seconds = Double.parseDouble(padded[2]);
        return hours * 3600 + minutes * 60 + seconds;
    }
}