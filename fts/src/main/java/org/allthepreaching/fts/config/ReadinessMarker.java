package org.allthepreaching.fts.config;

import jakarta.annotation.PreDestroy;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class ReadinessMarker {

    private static final Path READY_PATH = Path.of("/tmp/fts-indexer-ready");

    @EventListener(ApplicationReadyEvent.class)
    public void markReady() throws IOException {
        Files.writeString(READY_PATH, "ready\n");
    }

    @PreDestroy
    public void clearReady() throws IOException {
        Files.deleteIfExists(READY_PATH);
    }
}