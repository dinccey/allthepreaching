# KJV Scripture Reading Video Plan

## Objective

Add a simple scripture-reading video generation pipeline that reuses the existing KJV Bible text, verse audio, and reader design direction already implemented in this repo.

The first version should produce videos with:

- KJV scripture text on screen
- existing Waggoner verse audio
- text progression that follows the audio
- simple, clean visuals aligned with the Bible reader UI
- an offline generation workflow using `ffmpeg`

This should start as a backend/offline media pipeline, not a real-time frontend feature.

## Existing Repo Assets To Reuse

### Current usable sources

- Bible text is already normalized into chapter JSON under `be/data/bible/en/books/<bookId>/chapters/<chapter>.json`.
- Canonical book metadata already exists in `be/services/bible/bookMetadata.js`.
- The current Bible data generator already maps verse audio and outputs chapter payloads through `be/scripts/buildBibleManifest.js`.
- The frontend Bible reader already establishes a simple scripture-reading visual model in `fe/pages/bible/[language]/[book]/[chapter].tsx` and related Bible UI components.

### What that means for the video pipeline

The video generator does not need to solve Bible normalization again.

It should consume the already-generated chapter payloads as its main source of truth and treat the normalized chapter JSON as the input contract.

## First-Version Scope

### In scope

- English only
- one chapter input produces one MP4 output
- simple branded reading layout
- verse-by-verse audio progression
- highlighted or focused current verse
- text changes paced by verse audio duration
- static or subtly animated background
- offline script execution from `be/`

### Out of scope for phase 1

- multi-language generation
- real-time browser rendering
- advanced motion graphics
- waveform-driven word-level karaoke sync
- automatic YouTube packaging metadata
- distributed rendering or queue workers
- per-word subtitle timing

## Recommended Technical Direction

## 1. Input Contract

Use the existing chapter payload as the base input.

Each generated chapter video job should load:

- chapter metadata
- ordered verses
- verse text
- verse audio paths
- chapter navigation metadata only if useful for batch workflows

Example effective source shape:

```json
{
  "language": "en",
  "translationLabel": "KJV",
  "book": {
    "id": "genesis",
    "name": "Genesis",
    "bookIndex": 1
  },
  "chapter": 1,
  "verses": [
    {
      "verse": 1,
      "text": "In the beginning God created the heaven and the earth.",
      "hasAudio": true,
      "audioPath": "https://.../01_GEN_01_01.mp3"
    }
  ]
}
```

## 2. Rendering Model

Do not make `ffmpeg` invent layout logic directly from raw JSON.

Introduce an intermediate scene manifest that is easier to generate and easier to debug.

Recommended flow:

1. Load chapter payload.
2. Probe verse audio durations.
3. Build a timed scene manifest.
4. Render the final video using `ffmpeg` from that manifest.

## 3. Scene Manifest Format

Create a generated chapter manifest for video rendering, for example:

```json
{
  "video": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "background": "parchment-dark"
  },
  "reference": {
    "language": "en",
    "bookId": "genesis",
    "bookName": "Genesis",
    "chapter": 1
  },
  "timeline": [
    {
      "verse": 1,
      "startMs": 0,
      "endMs": 4200,
      "durationMs": 4200,
      "audioPath": "/abs/path/to/01_GEN_01_01.mp3",
      "text": "In the beginning God created the heaven and the earth.",
      "layout": {
        "mode": "current-verse"
      }
    }
  ]
}
```

This manifest should be written to disk for inspection during development.

## 4. First Visual Style

The first visual style should stay intentionally simple.

Recommended phase-1 layout:

- 9:16 portrait output first
- subtle site-aligned background using existing color language
- top reference line: `Genesis 1`
- center text block showing the active verse
- optional previous and next verse in lower-contrast text above or below
- current verse emphasized with brighter text or a highlight bar
- no heavy animation beyond fade/slide transitions

Two good phase-1 display modes:

### Mode A: single active verse

- only the current verse is shown
- easiest to read
- easiest to sync
- best for simple generation

### Mode B: rolling verse context

- previous verse faded
- current verse emphasized
- next verse faintly visible

Recommendation: implement Mode A first.

## 5. Timing Strategy

The simplest reliable timing model is verse-level timing, not word-level timing.

For each verse:

- use `ffprobe` to get exact audio duration
- assign sequential `startMs` and `endMs`
- optionally add a very small tail pad such as `80ms` to avoid visual clipping

Timing formula:

$$
start_1 = 0
$$

$$
end_n = start_n + duration_n
$$

$$
start_{n+1} = end_n
$$

This is enough for a first scripture-reading video generator.

## 6. Audio Strategy

Use existing verse audio files as the audio backbone.

Recommended approach:

- resolve every verse audio file to an absolute local path
- generate an ffmpeg concat list in verse order
- concatenate the verse audio into one chapter audio track
- use that concatenated track as the final video audio

This is better than trying to make `ffmpeg` switch source files mid-filter for the first version.

## 7. `ffmpeg` Role

Use `ffmpeg` for final composition and encoding, not as the only logic layer.

Phase-1 `ffmpeg` responsibilities:

- create or ingest background video/image
- apply timed text overlays or subtitles
- compose final video frames
- attach concatenated chapter audio

## Current Encoding Notes

### Working profiles in this repo

- `social`: CPU `libx264` + `aac` in MP4 for broad upload compatibility.
- `gpu`: Intel GPU `hevc_vaapi` + `aac` in MP4 for faster rendering with better compression than the social profile on this machine.
- `av1`: CPU `libsvtav1` + `aac` in MP4 for a high-efficiency non-GPU path.

### Installed Intel GPU runtime in this environment

The container now has the Intel media stack required for VAAPI/QSV testing:

- `vainfo`
- `intel-media-va-driver-non-free`
- `intel-gpu-tools`
- `libvpl2`
- `libvpl-tools`
- `libmfx-gen1.2`

Validated device/runtime details:

- GPU kernel driver: Intel `i915`
- Render node: `/dev/dri/renderD128`
- VAAPI driver: Intel `iHD`

### Measured Genesis 1 sample outputs

Genesis 1, same content and duration:

- `social` output: `genesis-001.mp4` using `h264` + `aac`, size `6,916,831` bytes
- `gpu` output: `genesis-001.gpu.mp4` using `hevc` + `aac`, size `6,310,505` bytes
- `av1` output: `genesis-001.av1.mp4` using `av1` + `aac`, size `6,362,924` bytes

Current practical guidance:

- Use `gpu` for fastest efficient rendering on this Intel machine.
- Use `social` when maximum downstream compatibility matters most.
- Use `av1` when CPU-only rendering is acceptable and AV1 delivery is desired.
- YouTube upload prep should be generated as a sequential upload queue, not assumed to be a true media batch upload.

## YouTube Upload Workflow

### What YouTube supports

- YouTube Data API uploads are handled per video using `videos.insert`.
- Caption files are attached afterward per video using `captions.insert`.
- The practical automation model is sequential upload jobs, not a single true batch media upload request for many videos at once.

### Simplified upload strategy for this repo

Generate all upload metadata ahead of time so the actual uploader only has to walk a queue.

Per chapter, prepare:

- final video path
- final subtitle path (`.srt`)
- title
- description
- tags
- privacy status
- category id
- target playlist/book grouping

### Repo support added

The repo can now generate upload-ready YouTube manifests for rendered chapters:

- command: `npm run scripture-video:youtube-manifest -- --language en --profile gpu`
- JSON output: `be/data/scripture-video/upload/youtube/en/manifest.gpu.json`
- CSV output: `be/data/scripture-video/upload/youtube/en/manifest.gpu.csv`

These manifests are designed to feed a later uploader script or a manual upload workflow with minimal extra work.

### Recommended operational flow

1. Render videos with the desired profile.
2. Generate SRT subtitle files.
3. Generate the YouTube upload manifest.
4. Upload videos sequentially.
5. Upload captions sequentially after each video returns a YouTube `videoId`.
6. Optionally attach playlist membership in the same queue-driven workflow.
- encode final MP4

There are two reasonable rendering techniques.

### Option A: subtitle-driven rendering

- generate `.ass` subtitle files with styling
- let `ffmpeg` burn them into the video

Pros:

- easier text timing
- simpler than complex drawtext expressions
- good for verse-by-verse highlighting

Cons:

- more limited layout flexibility

### Option B: `drawtext` filter graph

- generate timed `drawtext` expressions per verse

Pros:

- highly flexible

Cons:

- hard to maintain
- hard to debug

Recommendation: use `.ass` subtitle generation first.

## 8. Recommended Pipeline

### Phase-1 pipeline

1. Read normalized chapter JSON.
2. Validate that all verses to be rendered have audio.
3. Probe verse durations with `ffprobe`.
4. Build a chapter timeline manifest.
5. Write a concat file for chapter audio.
6. Generate chapter-level concatenated audio.
7. Generate an `.ass` subtitle file with styled verse timing.
8. Render final MP4 with `ffmpeg`.
9. Write output metadata and validation report.

## Files To Add

### Backend scripts

- `be/scripts/buildScriptureVideoManifest.js`
- `be/scripts/renderScriptureVideo.js`
- `be/scripts/renderScriptureVideoBatch.js`

### Backend services

- `be/services/scriptureVideo/chapterLoader.js`
- `be/services/scriptureVideo/audioProbe.js`
- `be/services/scriptureVideo/timelineBuilder.js`
- `be/services/scriptureVideo/subtitleRenderer.js`
- `be/services/scriptureVideo/ffmpegRunner.js`
- `be/services/scriptureVideo/theme.js`

### Output folders

- `be/data/scripture-video/manifests/`
- `be/data/scripture-video/audio/`
- `be/data/scripture-video/subtitles/`
- `be/data/scripture-video/output/`
- `be/data/scripture-video/reports/`

## Proposed CLI Contracts

### Render one chapter

```bash
node be/scripts/renderScriptureVideo.js --language en --book genesis --chapter 1
```

### Render a batch

```bash
node be/scripts/renderScriptureVideoBatch.js --language en --book genesis --chapters 1-5
```

### Optional style variant

```bash
node be/scripts/renderScriptureVideo.js --language en --book psalms --chapter 23 --theme simple-reader
```

## Required Services

## 1. Chapter Loader

Responsibilities:

- load normalized chapter JSON
- validate verse order
- validate presence of text
- resolve audio paths into usable local paths or downloadable URLs

## 2. Audio Probe Service

Responsibilities:

- call `ffprobe`
- get verse duration
- return normalized duration data
- flag broken or unreadable files

## 3. Timeline Builder

Responsibilities:

- create a strictly ordered verse timeline
- compute cumulative start and end times
- add optional transition padding
- expose total chapter duration

## 4. Subtitle Renderer

Responsibilities:

- emit `.ass` subtitle files
- style current verse text
- optionally emit reference header text
- keep typography readable for portrait video

## 5. FFmpeg Runner

Responsibilities:

- generate concat chapter audio
- render background layer
- burn subtitles into final output
- encode MP4 with stable defaults
- return useful logs on failure

## Video Theme Recommendations

The design should stay close to the site, but simplified for video.

### Dark theme recommendation

- background: `scheme-e` / `scheme-c` family
- text: warm off-white
- emphasis: current `primary`
- border/accent: muted gold-brown derived from current theme

### Light theme recommendation

- parchment-like off-white background
- dark brown text
- primary accent reused from site highlight color

Recommendation: ship dark first.

## Default Render Settings

### Portrait preset

- width: `1080`
- height: `1920`
- fps: `30`
- codec: `libx264`
- audio codec: `aac`
- pixel format: `yuv420p`

### Optional landscape preset later

- width: `1920`
- height: `1080`

## Suggested Output Naming

```text
be/data/scripture-video/output/en/genesis/genesis-001.mp4
be/data/scripture-video/output/en/psalms/psalms-023.mp4
```

## Validation Rules

The render script should fail or warn clearly for:

- missing chapter JSON
- missing verse text
- missing verse audio
- unreadable audio file
- zero-duration audio
- invalid ffmpeg binary path
- invalid ffprobe binary path
- empty chapter timeline

Each render should also emit a report, for example:

```json
{
  "language": "en",
  "bookId": "genesis",
  "chapter": 1,
  "renderedAt": "2026-04-30T00:00:00.000Z",
  "durationMs": 123456,
  "verseCount": 31,
  "warnings": []
}
```

## Environment Variables

Suggested config:

- `SCRIPTURE_VIDEO_FFMPEG_BIN`
- `SCRIPTURE_VIDEO_FFPROBE_BIN`
- `SCRIPTURE_VIDEO_OUTPUT_ROOT`
- `SCRIPTURE_VIDEO_THEME`
- `SCRIPTURE_VIDEO_WIDTH`
- `SCRIPTURE_VIDEO_HEIGHT`
- `SCRIPTURE_VIDEO_FPS`

## Run The Full Bible Bundle

From `be/`, run:

```bash
npm run scripture-video:prepare-youtube-all -- --language en --profile gpu
```

This one command:

- renders the full Bible sequentially
- writes the YouTube `.srt` subtitle next to each rendered video
- rebuilds the YouTube upload manifest JSON and CSV after rendering

Current default output is `1920x1080` at `30fps`, so the generated videos are `1080p` landscape.

If you want to override the size later, use:

- `SCRIPTURE_VIDEO_WIDTH`
- `SCRIPTURE_VIDEO_HEIGHT`
- `SCRIPTURE_VIDEO_FPS`

Quick validation run:

```bash
npm run scripture-video:prepare-youtube-all -- --language en --profile gpu --limit 1 --progressFile /tmp/atp-prepare-all-progress.json
```

## Phased Implementation Plan

## Phase 1: render a single chapter successfully

Goal:

- render one chapter to MP4 with verse text and concatenated audio

Tasks:

- add chapter loader
- add ffprobe duration helper
- add timeline manifest generator
- add concat-audio generator
- add `.ass` subtitle writer
- render one chapter with `ffmpeg`

Acceptance:

- `Genesis 1` renders successfully to MP4
- verse text switches in sync with verse audio
- output plays in standard players

## Phase 2: align visuals with site design

Goal:

- make the video look recognizably like the current Bible experience

Tasks:

- define dark theme palette from site tokens
- refine typography and spacing
- add chapter header styling
- add subtle fade transitions

Acceptance:

- output looks consistent with site branding
- text remains readable on phone screens

## Phase 3: batch generation

Goal:

- render multiple chapters or books without manual repetition

Tasks:

- add batch CLI
- add resumable output detection
- add render reports

Acceptance:

- a multi-chapter batch completes with readable logs

## Phase 4: future enhancements

Potential later work:

- landscape preset
- rolling context mode
- branded intro/outro
- background motion layers
- subtitle export sidecar files
- per-word timing if transcripts ever exist
- queue-based rendering service

## Recommended First Deliverable

Start with:

- `Genesis 1`
- portrait video
- dark theme
- current verse only
- verse-by-verse timing
- concatenated verse audio
- `.ass` subtitle rendering

That is the highest-leverage first slice because it proves:

- the normalized Bible data is usable for video
- the Waggoner verse audio is renderable in sequence
- ffmpeg integration works in this repo
- the UI direction can extend into generated media

## Suggested Package Updates

If the implementation needs helper packages, keep them minimal.

Reasonable additions if needed:

- none initially if shelling out to `ffmpeg` and `ffprobe`
- optionally a small CLI arg parser later

Do not pull in a browser rendering stack for phase 1 unless the simple ffmpeg-plus-subtitles pipeline proves too limiting.

## Success Criteria

The plan is successful when this repo can generate a chapter video that:

- uses the existing normalized Bible text
- uses the existing verse audio mapping
- shows scripture text in sync with audio
- produces a portable MP4 output
- is simple enough to batch later without re-architecting