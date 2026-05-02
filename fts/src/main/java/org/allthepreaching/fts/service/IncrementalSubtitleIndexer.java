package org.allthepreaching.fts.service;

import org.allthepreaching.fts.config.IndexerProperties;
import org.allthepreaching.fts.model.FileSnapshot;
import org.allthepreaching.fts.model.ResolvedSubtitlePath;
import org.allthepreaching.fts.model.SubtitleCue;
import org.allthepreaching.fts.model.TrackerRecord;
import org.allthepreaching.fts.model.VideoCandidate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class IncrementalSubtitleIndexer {

    private static final Logger logger = LoggerFactory.getLogger(IncrementalSubtitleIndexer.class);
    private static final String DUPLICATE_MAPPING_PREFIX = "duplicate-mapping/";

    private final IndexerProperties properties;
    private final VideoSourceRepository videoSourceRepository;
    private final TrackerRepository trackerRepository;
    private final SubtitleDocumentRepository subtitleDocumentRepository;
    private final SubtitlePathResolver subtitlePathResolver;
    private final SimpleVttParser simpleVttParser;
    private final HashingService hashingService;
    private final TransactionTemplate transactionTemplate;

    public IncrementalSubtitleIndexer(
        IndexerProperties properties,
        VideoSourceRepository videoSourceRepository,
        TrackerRepository trackerRepository,
        SubtitleDocumentRepository subtitleDocumentRepository,
        SubtitlePathResolver subtitlePathResolver,
        SimpleVttParser simpleVttParser,
        HashingService hashingService,
        PlatformTransactionManager transactionManager
    ) {
        this.properties = properties;
        this.videoSourceRepository = videoSourceRepository;
        this.trackerRepository = trackerRepository;
        this.subtitleDocumentRepository = subtitleDocumentRepository;
        this.subtitlePathResolver = subtitlePathResolver;
        this.simpleVttParser = simpleVttParser;
        this.hashingService = hashingService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public void runIncrementalIndexing() {
        Instant startedAt = Instant.now();
        trackerRepository.markRunStarted(startedAt);
        try {
            long lastVideoPk = 0;
            while (true) {
                List<VideoCandidate> batch = videoSourceRepository.findCandidatesAfter(lastVideoPk, properties.getBatchSize());
                if (batch.isEmpty()) {
                    break;
                }

                for (VideoCandidate candidate : batch) {
                    try {
                        transactionTemplate.executeWithoutResult(status -> processCandidate(candidate));
                    } catch (RuntimeException exception) {
                        logger.error("Failed to index video {}: {}", candidate.videoPk(), exception.getMessage(), exception);
                        recordFailure(candidate, exception);
                    }
                    lastVideoPk = candidate.videoPk();
                }
            }

            trackerRepository.markRunSuccess(Instant.now());
        } catch (RuntimeException exception) {
            trackerRepository.markRunFailure(Instant.now(), exception.getMessage());
            throw exception;
        }
    }

    public boolean runSingleVideo(long videoPk) {
        Instant startedAt = Instant.now();
        trackerRepository.markRunStarted(startedAt);
        try {
            Optional<VideoCandidate> candidate = videoSourceRepository.findVideoById(videoPk);
            if (candidate.isEmpty()) {
                logger.warn("Video {} was not found for single-run indexing", videoPk);
                trackerRepository.markRunSuccess(Instant.now());
                return false;
            }

            transactionTemplate.executeWithoutResult(status -> processCandidate(candidate.get()));
            trackerRepository.markRunSuccess(Instant.now());
            return true;
        } catch (RuntimeException exception) {
            trackerRepository.markRunFailure(Instant.now(), exception.getMessage());
            throw exception;
        }
    }

    public void refreshTrackedFiles() {
        long lastTrackerId = 0;
        while (true) {
            List<TrackerRecord> trackers = trackerRepository.findTrackedFilesAfter(lastTrackerId, properties.getBatchSize());
            if (trackers.isEmpty()) {
                break;
            }

            for (TrackerRecord tracker : trackers) {
                try {
                    transactionTemplate.executeWithoutResult(status -> refreshTrackedFile(tracker));
                } catch (RuntimeException exception) {
                    logger.error("Tracked file refresh failed for tracker {}: {}", tracker.trackerId(), exception.getMessage(), exception);
                }
                lastTrackerId = tracker.trackerId();
            }
        }
    }

    public void cleanupRemovedVideos() {
        long lastTrackerId = 0;
        while (true) {
            List<TrackerRecord> trackers = trackerRepository.findTrackersForRemovedVideosAfter(lastTrackerId, properties.getBatchSize());
            if (trackers.isEmpty()) {
                break;
            }

            for (TrackerRecord tracker : trackers) {
                transactionTemplate.executeWithoutResult(status -> removeDeletedVideo(tracker));
                lastTrackerId = tracker.trackerId();
            }
        }
    }

    private void processCandidate(VideoCandidate candidate) {
        ResolvedSubtitlePath resolved = subtitlePathResolver.resolve(candidate.videoUrl());
        TrackerRecord tracker = candidate.tracker();
        Instant now = Instant.now();

        Optional<TrackerRecord> conflictingTracker = findConflictingTracker(candidate, resolved);
        if (conflictingTracker.isPresent()) {
            markDuplicateMapping(candidate, tracker, resolved, conflictingTracker.get(), now);
            return;
        }

        if (resolved == null || !Files.exists(resolved.absolutePath())) {
            markMissingFile(candidate, tracker, resolved, now);
            return;
        }

        try {
            FileSnapshot snapshot = FileSnapshot.from(resolved.absolutePath());
            boolean fileStatChanged = tracker == null || !tracker.matches(resolved.absolutePath(), snapshot);
            boolean metadataChanged = tracker == null
                || !tracker.processed()
                || !equalsInstant(tracker.sourceUpdatedAt(), candidate.updatedAt())
                || tracker.fileDeleted();

            if (!fileStatChanged && !metadataChanged) {
                return;
            }

            String fileHash = (fileStatChanged || tracker == null || tracker.fileHash() == null)
                ? hashingService.hashFile(resolved.absolutePath())
                : tracker.fileHash();

            List<SubtitleCue> cues = simpleVttParser.parse(resolved.absolutePath());

            TrackerRecord activeTracker = trackerRepository.upsertTracker(
                candidate.videoPk(),
                resolved.absolutePath().toString(),
                resolved.relativePath(),
                false,
                false,
                null,
                fileStatChanged,
                fileHash,
                null,
                snapshot.modifiedAt(),
                snapshot.size(),
                candidate.updatedAt(),
                now
            );

            subtitleDocumentRepository.deleteByVideoPk(candidate.videoPk());
            trackerRepository.deleteIndexItems(activeTracker.trackerId());
            List<String> documentIds = subtitleDocumentRepository.insertDocuments(candidate, resolved.relativePath(), cues);
            trackerRepository.insertIndexItems(activeTracker.trackerId(), documentIds);

            trackerRepository.upsertTracker(
                candidate.videoPk(),
                resolved.absolutePath().toString(),
                resolved.relativePath(),
                true,
                false,
                null,
                false,
                fileHash,
                now,
                snapshot.modifiedAt(),
                snapshot.size(),
                candidate.updatedAt(),
                now
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to process subtitle file for video " + candidate.videoPk(), exception);
        }
    }

    private void markDuplicateMapping(
        VideoCandidate candidate,
        TrackerRecord tracker,
        ResolvedSubtitlePath resolved,
        TrackerRecord conflictingTracker,
        Instant now
    ) {
        if (tracker != null) {
            subtitleDocumentRepository.deleteByVideoPk(candidate.videoPk());
            trackerRepository.deleteIndexItems(tracker.trackerId());
        }

        String duplicateMessage = String.format(
            "Duplicate subtitle mapping: subtitle file already belongs to video %d (%s)",
            conflictingTracker.videoPk(),
            resolved.relativePath()
        );
        logger.warn("{} for video {}", duplicateMessage, candidate.videoPk());

        trackerRepository.upsertTracker(
            candidate.videoPk(),
            duplicateTrackerFilePath(candidate, resolved),
            resolved.relativePath(),
            true,
            false,
            duplicateMessage,
            false,
            tracker == null ? null : tracker.fileHash(),
            now,
            null,
            null,
            candidate.updatedAt(),
            now
        );
    }

    private void refreshTrackedFile(TrackerRecord tracker) {
        Optional<VideoCandidate> videoCandidate = videoSourceRepository.findVideoById(tracker.videoPk());
        if (videoCandidate.isEmpty()) {
            removeDeletedVideo(tracker);
            return;
        }

        processCandidate(videoCandidate.get());
    }

    private void removeDeletedVideo(TrackerRecord tracker) {
        subtitleDocumentRepository.deleteByVideoPk(tracker.videoPk());
        trackerRepository.deleteIndexItems(tracker.trackerId());
        trackerRepository.deleteTracker(tracker.trackerId());
    }

    private void markMissingFile(VideoCandidate candidate, TrackerRecord tracker, ResolvedSubtitlePath resolved, Instant now) {
        String filePath = resolved == null ? fallbackFilePath(candidate, tracker) : resolved.absolutePath().toString();
        String subtitlePath = resolved == null ? fallbackSubtitlePath(candidate, tracker) : resolved.relativePath();

        if (tracker != null) {
            subtitleDocumentRepository.deleteByVideoPk(candidate.videoPk());
            trackerRepository.deleteIndexItems(tracker.trackerId());
        }

        trackerRepository.upsertTracker(
            candidate.videoPk(),
            filePath,
            subtitlePath,
            true,
            true,
            "Subtitle file missing",
            false,
            tracker == null ? null : tracker.fileHash(),
            now,
            null,
            null,
            candidate.updatedAt(),
            now
        );
    }

    private void recordFailure(VideoCandidate candidate, RuntimeException exception) {
        ResolvedSubtitlePath resolved = subtitlePathResolver.resolve(candidate.videoUrl());
        Optional<TrackerRecord> conflictingTracker = findConflictingTracker(candidate, resolved);
        TrackerRecord tracker = trackerRepository.upsertTracker(
            candidate.videoPk(),
            conflictingTracker.isPresent()
                ? duplicateTrackerFilePath(candidate, resolved)
                : resolved == null ? fallbackFilePath(candidate, candidate.tracker()) : resolved.absolutePath().toString(),
            resolved == null ? fallbackSubtitlePath(candidate, candidate.tracker()) : resolved.relativePath(),
            true,
            false,
            exception.getMessage(),
            false,
            candidate.tracker() == null ? null : candidate.tracker().fileHash(),
            Instant.now(),
            candidate.tracker() == null ? null : candidate.tracker().fileMtime(),
            candidate.tracker() == null ? null : candidate.tracker().fileSize(),
            candidate.updatedAt(),
            Instant.now()
        );

        if (tracker != null) {
            trackerRepository.deleteIndexItems(tracker.trackerId());
            subtitleDocumentRepository.deleteByVideoPk(candidate.videoPk());
        }
    }

    private boolean equalsInstant(Instant left, Instant right) {
        if (left == null && right == null) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        return left.equals(right);
    }

    private String fallbackFilePath(VideoCandidate candidate, TrackerRecord tracker) {
        if (tracker != null && tracker.filePath() != null && !tracker.filePath().isBlank()) {
            return tracker.filePath();
        }
        return Path.of(properties.getSubtitleRoot(), fallbackSubtitlePath(candidate, tracker)).toString();
    }

    private String fallbackSubtitlePath(VideoCandidate candidate, TrackerRecord tracker) {
        if (tracker != null && tracker.subtitlePath() != null && !tracker.subtitlePath().isBlank()) {
            return tracker.subtitlePath();
        }
        return "unresolved/video-" + candidate.videoPk() + ".vtt";
    }

    private String duplicateTrackerFilePath(VideoCandidate candidate, ResolvedSubtitlePath resolved) {
        String suffix = resolved == null
            ? fallbackSubtitlePath(candidate, null)
            : resolved.relativePath().replace('\\', '/');
        return Path.of(properties.getSubtitleRoot(), DUPLICATE_MAPPING_PREFIX + "video-" + candidate.videoPk() + "-" + suffix).toString();
    }

    private Optional<TrackerRecord> findConflictingTracker(VideoCandidate candidate, ResolvedSubtitlePath resolved) {
        if (resolved == null) {
            return Optional.empty();
        }

        Optional<TrackerRecord> conflictingTracker = trackerRepository.findTrackerByFilePath(resolved.absolutePath().toString());
        if (conflictingTracker.isPresent() && conflictingTracker.get().videoPk() != candidate.videoPk()) {
            return conflictingTracker;
        }

        return Optional.empty();
    }
}