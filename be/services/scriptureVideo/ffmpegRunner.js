const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { getTheme } = require('./theme');
const { getCodecProfile } = require('./codecProfiles');

function execFileAsync(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, { ...options, maxBuffer: 1024 * 1024 * 16 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

async function writeConcatList(timeline, concatListPath) {
    const content = timeline
        .map((entry) => `file '${entry.audioPath.replace(/'/g, "'\\''")}'`)
        .join('\n');
    await fs.mkdir(path.dirname(concatListPath), { recursive: true });
    await fs.writeFile(concatListPath, `${content}\n`, 'utf8');
}

function buildVideoFilter({ manifest, subtitlePath, theme }) {
    const subtitleFile = path.basename(subtitlePath).replace(/\\/g, '/').replace(/:/g, '\\:');
    return `subtitles=${subtitleFile}`;
}

function buildEncodeFilter({ manifest, subtitlePath, theme, codecProfile }) {
    const baseFilter = buildVideoFilter({ manifest, subtitlePath, theme });

    if (codecProfile.hardware?.backend === 'vaapi') {
        return `${baseFilter},format=nv12,hwupload`;
    }

    return baseFilter;
}

async function renderChapterVideo({ manifest, subtitlePath, audioOutputPath, concatListPath, outputPath, workingDirectory, codecProfileName = 'social' }) {
    const ffmpegBin = process.env.SCRIPTURE_VIDEO_FFMPEG_BIN || 'ffmpeg';
    const theme = getTheme(manifest.video.theme);
    const codecProfile = getCodecProfile(codecProfileName);

    await writeConcatList(manifest.timeline, concatListPath);

    await execFileAsync(ffmpegBin, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c:a', 'libmp3lame',
        '-q:a', '2',
        audioOutputPath,
    ], { cwd: workingDirectory });

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await execFileAsync(ffmpegBin, [
        '-y',
        '-f', 'lavfi',
        '-i', `color=c=${theme.backgroundColor}:s=${manifest.video.width}x${manifest.video.height}:r=${manifest.video.fps}:d=${(manifest.totalDurationMs / 1000).toFixed(3)}`,
        '-i', audioOutputPath,
        '-vf', buildEncodeFilter({ manifest, subtitlePath, theme, codecProfile }),
        ...codecProfile.ffmpegArgs,
        '-shortest',
        outputPath,
    ], { cwd: workingDirectory });

    return codecProfile;
}

module.exports = {
    renderChapterVideo,
};