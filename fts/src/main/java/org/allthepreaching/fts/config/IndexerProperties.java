package org.allthepreaching.fts.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "indexer")
public class IndexerProperties {

    private boolean enabled = true;
    private String subtitleRoot = "/var/videos";
    private int batchSize = 250;
    private int refreshBatchLimit = 2000;
    // How often a caption file recorded as missing is looked at again. Production
    // carries ~14.5k deletion markers and re-checking every one of them on every pass
    // is what made a single scan run take ~12h. A window still retries them - a file
    // can always come back - without letting them dominate the pass.
    private int missingRetryHours = 24;
    private boolean runOnStartup = false;
    private String startupMode = "incremental";
    private long singleVideoId = 0;
    private boolean exitAfterStartupRun = false;
    private String scanCron = "0 */10 * * * *";
    private String trackedFileCron = "0 */20 * * * *";
    private String cleanupCron = "0 */30 * * * *";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getSubtitleRoot() {
        return subtitleRoot;
    }

    public void setSubtitleRoot(String subtitleRoot) {
        this.subtitleRoot = subtitleRoot;
    }

    public int getBatchSize() {
        return batchSize;
    }

    public int getRefreshBatchLimit() {
        return refreshBatchLimit;
    }

    public void setRefreshBatchLimit(int refreshBatchLimit) {
        this.refreshBatchLimit = refreshBatchLimit;
    }

    public int getMissingRetryHours() {
        return missingRetryHours;
    }

    public void setMissingRetryHours(int missingRetryHours) {
        this.missingRetryHours = missingRetryHours;
    }

    public void setBatchSize(int batchSize) {
        this.batchSize = batchSize;
    }

    public boolean isRunOnStartup() {
        return runOnStartup;
    }

    public void setRunOnStartup(boolean runOnStartup) {
        this.runOnStartup = runOnStartup;
    }

    public long getSingleVideoId() {
        return singleVideoId;
    }

    public String getStartupMode() {
        return startupMode;
    }

    public void setStartupMode(String startupMode) {
        this.startupMode = startupMode;
    }

    public void setSingleVideoId(long singleVideoId) {
        this.singleVideoId = singleVideoId;
    }

    public boolean isExitAfterStartupRun() {
        return exitAfterStartupRun;
    }

    public void setExitAfterStartupRun(boolean exitAfterStartupRun) {
        this.exitAfterStartupRun = exitAfterStartupRun;
    }

    public String getScanCron() {
        return scanCron;
    }

    public void setScanCron(String scanCron) {
        this.scanCron = scanCron;
    }

    public String getTrackedFileCron() {
        return trackedFileCron;
    }

    public void setTrackedFileCron(String trackedFileCron) {
        this.trackedFileCron = trackedFileCron;
    }

    public String getCleanupCron() {
        return cleanupCron;
    }

    public void setCleanupCron(String cleanupCron) {
        this.cleanupCron = cleanupCron;
    }
}