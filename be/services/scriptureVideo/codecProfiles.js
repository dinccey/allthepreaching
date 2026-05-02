function getCodecProfile(name = 'social') {
    if (name === 'social') {
        return {
            id: 'social',
            label: 'Social media compatible',
            containerExtension: 'mp4',
            videoCodec: 'libx264',
            audioCodec: 'aac',
            ffmpegArgs: [
                '-c:v', 'libx264',
                '-preset', 'slow',
                '-crf', '21',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '160k',
                '-movflags', '+faststart',
            ],
        };
    }

    if (name === 'gpu') {
        return {
            id: 'gpu',
            label: 'GPU accelerated HEVC (VAAPI)',
            containerExtension: 'mp4',
            videoCodec: 'hevc_vaapi',
            audioCodec: 'aac',
            hardware: {
                backend: 'vaapi',
                device: process.env.SCRIPTURE_VIDEO_VAAPI_DEVICE || '/dev/dri/renderD128',
            },
            ffmpegArgs: [
                '-vaapi_device', process.env.SCRIPTURE_VIDEO_VAAPI_DEVICE || '/dev/dri/renderD128',
                '-c:v', 'hevc_vaapi',
                '-qp', '28',
                '-c:a', 'aac',
                '-b:a', '96k',
                '-movflags', '+faststart',
            ],
        };
    }

    if (name === 'av1') {
        return {
            id: 'av1',
            label: 'Smallest static-background file size',
            containerExtension: 'mp4',
            videoCodec: 'libsvtav1',
            audioCodec: 'aac',
            ffmpegArgs: [
                '-c:v', 'libsvtav1',
                '-preset', '6',
                '-crf', '34',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '96k',
                '-movflags', '+faststart',
            ],
        };
    }

    throw new Error(`Unsupported scripture video codec profile: ${name}`);
}

module.exports = {
    getCodecProfile,
};