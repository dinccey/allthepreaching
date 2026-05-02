const { execFile } = require('child_process');

function execFileAsync(command, args) {
    return new Promise((resolve, reject) => {
        execFile(command, args, { maxBuffer: 1024 * 1024 * 8 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
                return;
            }
            resolve(stdout);
        });
    });
}

async function probeDurationMs(filePath) {
    if (!filePath) {
        throw new Error('Missing audio file path');
    }

    const ffprobeBin = process.env.SCRIPTURE_VIDEO_FFPROBE_BIN || 'ffprobe';
    const stdout = await execFileAsync(ffprobeBin, [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'json',
        filePath,
    ]);
    const parsed = JSON.parse(stdout);
    const durationSeconds = parseFloat(parsed?.format?.duration || '0');

    if (Number.isNaN(durationSeconds) || durationSeconds <= 0) {
        throw new Error(`Invalid audio duration for ${filePath}`);
    }

    return Math.round(durationSeconds * 1000);
}

module.exports = {
    probeDurationMs,
};