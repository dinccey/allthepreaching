package org.allthepreaching.fts.scheduled;

import org.allthepreaching.fts.config.IndexerProperties;
import org.allthepreaching.fts.service.IncrementalSubtitleIndexer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

@Component
public class IndexingScheduler {

    private static final Logger logger = LoggerFactory.getLogger(IndexingScheduler.class);

    private final IndexerProperties properties;
    private final IncrementalSubtitleIndexer indexer;
    private final AtomicBoolean indexingRunning = new AtomicBoolean(false);
    private final AtomicBoolean cleanupRunning = new AtomicBoolean(false);

    public IndexingScheduler(IndexerProperties properties, IncrementalSubtitleIndexer indexer) {
        this.properties = properties;
        this.indexer = indexer;
    }

    @Scheduled(cron = "${indexer.scan-cron}")
    public void runIncrementalIndex() {
        if (!properties.isEnabled()) {
            return;
        }
        if (!indexingRunning.compareAndSet(false, true)) {
            logger.info("Incremental indexing skipped because another run is still active");
            return;
        }

        try {
            indexer.runIncrementalIndexing();
        } finally {
            indexingRunning.set(false);
        }
    }

    @Scheduled(cron = "${indexer.tracked-file-cron}")
    public void refreshTrackedFiles() {
        if (!properties.isEnabled()) {
            return;
        }
        if (!indexingRunning.compareAndSet(false, true)) {
            logger.info("Tracked-file scan skipped because indexing is already active");
            return;
        }

        try {
            indexer.refreshTrackedFiles();
        } finally {
            indexingRunning.set(false);
        }
    }

    @Scheduled(cron = "${indexer.cleanup-cron}")
    public void cleanupRemovedVideos() {
        if (!properties.isEnabled()) {
            return;
        }
        if (!cleanupRunning.compareAndSet(false, true)) {
            logger.info("Cleanup skipped because another cleanup run is still active");
            return;
        }

        try {
            indexer.cleanupRemovedVideos();
        } finally {
            cleanupRunning.set(false);
        }
    }
}