package org.allthepreaching.fts.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "indexer")
public class IndexerProperties {

    private boolean enabled = true;
    private String subtitleRoot = "/var/videos";
    private int batchSize = 250;
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