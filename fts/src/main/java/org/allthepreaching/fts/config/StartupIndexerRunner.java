package org.allthepreaching.fts.config;

import org.allthepreaching.fts.service.IncrementalSubtitleIndexer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

@Component
public class StartupIndexerRunner implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(StartupIndexerRunner.class);

    private final IndexerProperties properties;
    private final IncrementalSubtitleIndexer indexer;
    private final ConfigurableApplicationContext applicationContext;

    public StartupIndexerRunner(
        IndexerProperties properties,
        IncrementalSubtitleIndexer indexer,
        ConfigurableApplicationContext applicationContext
    ) {
        this.properties = properties;
        this.indexer = indexer;
        this.applicationContext = applicationContext;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!properties.isEnabled() || !properties.isRunOnStartup()) {
            return;
        }

        if (properties.getSingleVideoId() > 0) {
            logger.info("Running startup index for single video {}", properties.getSingleVideoId());
            indexer.runSingleVideo(properties.getSingleVideoId());
            exitIfRequested();
            return;
        }

        String startupMode = properties.getStartupMode() == null
            ? "incremental"
            : properties.getStartupMode().trim().toLowerCase();

        switch (startupMode) {
            case "tracked-file-refresh":
                logger.info("Running startup tracked-file refresh pass");
                indexer.refreshTrackedFiles();
                break;
            case "cleanup":
                logger.info("Running startup cleanup pass");
                indexer.cleanupRemovedVideos();
                break;
            case "incremental":
            default:
                logger.info("Running startup incremental index pass");
                indexer.runIncrementalIndexing();
                break;
        }
        exitIfRequested();
    }

    private void exitIfRequested() {
        if (!properties.isExitAfterStartupRun()) {
            return;
        }

        logger.info("Startup index run completed, exiting application by configuration");
        int exitCode = org.springframework.boot.SpringApplication.exit(applicationContext, () -> 0);
        System.exit(exitCode);
    }
}