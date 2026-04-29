# KJV Bible Reading + Audio Architecture Plan

## Goal

Add a Bible reading and audio experience to ALLthePREACHING with:

- first-class English support now, but architecture prepared for multiple languages
- text Bible plus verse audio playback
- simple language switching where language acts as the version selector
- intuitive Bible-app-style navigation similar to YouVersion
- reading progress cached in the client browser via localStorage in phase 1
- chapter-level preloading and local caching for smooth playback
- audio hosted on the same `kjv1611only.com` origin as the rest of the media archive

## Grounded Findings From This Repo

### Existing app architecture

- Frontend is a Next.js pages-router app under `fe/pages`.
- Backend is an Express API under `be/routes`, registered in `be/server.js`.
- Media URLs already flow through the backend/provider abstraction via `be/providers/VideoProvider.js`.
- The frontend already uses SWR for API data fetching in `fe/hooks/useApi.ts`.
- The frontend already ships a service worker at `fe/public/sw.js`, but it is generic and not yet specialized for large Bible audio caches.

### Waggoner audio corpus facts

- The corpus contains 66 top-level book folders and 32,357 mp3 files.
- File layout is one directory per book, for example `Waggoner_verses/01-Genesis`.
- Verse audio filenames encode `bookIndex_bookCode_chapterIndex_verseIndex.mp3`.
- Example verse file: `Waggoner_verses/01-Genesis/01_GEN_01_01.mp3`.
- There are also `00` audio markers that appear to represent intros or boundaries, not normal verses.
- Example book intro: `01_GEN_00_00.mp3`.
- Example chapter intro: `01_GEN_01_00.mp3`.
- Psalms uses three-digit chapter and verse slots, for example `19_PSA_001_001.mp3`, so parsing cannot assume fixed two-digit chapter and verse widths.
- Folder naming is not canonical enough to be the primary key because casing and formatting vary, for example `06-joshua`, `48-Galatians`, `09-1samuel`.

### Bible JSON source facts

The requested Bible JSON source uses a simple canonical structure:

```json
{
  "Genesis": {
    "1": {
      "1": "In the beginning God created the heaven and the earth.",
      "2": "And the earth was without form..."
    }
  }
}
```

That makes it a good source of truth for:

- canonical book names
- chapter counts
- verse counts
- text rendering

It is not sufficient by itself for audio, because the Waggoner corpus has its own indexing, abbreviations, and intro files.

## Recommended Architecture

## 1. Source of Truth Strategy

Use two normalized sources:

1. Bible text source: Bible JSON repository structure, imported as the canonical text dataset.
2. Audio manifest source: a generated manifest derived from scanning `Waggoner_verses` and validating it against the Bible text dataset.

Do not treat raw folder names or raw mp3 filenames as frontend-facing identifiers.

Instead introduce a generated normalized manifest per language, for example:

```json
{
  "language": "en",
  "label": "English",
  "translation": "KJV",
  "books": [
    {
      "id": "genesis",
      "bookIndex": 1,
      "name": "Genesis",
      "code": "GEN",
      "hasAudio": true,
      "chapters": {
        "1": {
          "hasIntroAudio": true,
          "audioVerseCount": 31,
          "verses": {
            "1": {
              "text": "In the beginning God created the heaven and the earth.",
              "audioPath": "/audio/bible/en/01-Genesis/01_GEN_01_01.mp3",
              "hasAudio": true
            }
          }
        }
      }
    }
  ]
}
```

This should be generated, not handwritten.

## 1.1 Data Packaging And Fetch Efficiency

Do not ship the entire normalized Bible payload to the client as one giant JSON file.

That would be simple to generate, but inefficient in practice because:

- the full text plus audio metadata across all books is much larger than a typical reader session needs
- the user usually navigates one chapter at a time
- language packs will multiply the payload size later
- it would make cache invalidation and incremental updates more expensive

### Options considered

#### Option A: one single normalized JSON per language

Example:

- `be/data/bible/en/full.json`

Pros:

- simplest generation pipeline
- one in-memory object on the backend
- easiest offline export story

Cons:

- too large for normal client fetching
- poor fit for chapter-by-chapter reading
- wasteful for mobile bandwidth and memory
- harder to update partially

Recommendation: do not use this as the client-facing fetch format.

#### Option B: book-level JSON files

Example:

- `be/data/bible/en/books/genesis.json`
- `be/data/bible/en/books/exodus.json`

Pros:

- much smaller than a full-language blob
- good if the user stays inside one book for a while
- fewer files than chapter-level sharding

Cons:

- still larger than necessary for first chapter load, especially in long books like Psalms or Isaiah
- chapter transitions still require parsing large book payloads

Recommendation: acceptable for internal build artifacts, but not ideal as the primary runtime fetch unit.

#### Option C: chapter-level JSON files with a compact reference index

Example:

- `be/data/bible/en/index.json`
- `be/data/bible/en/books/genesis/chapters/1.json`
- `be/data/bible/en/books/genesis/chapters/2.json`

Pros:

- best fit for actual reader usage
- minimal first-load payload
- straightforward next-chapter prefetch
- easy cache invalidation at chapter granularity
- easy to support smooth route transitions and chapter-local audio playlists

Cons:

- many more generated files
- requires a compact metadata index to avoid filesystem discovery at runtime

Recommendation: this is the best default runtime shape.

#### Option D: chapter JSON plus sliced verse-part payloads

This would mean splitting a chapter into smaller blocks, for example:

- verses `1-10`
- verses `11-20`
- verses `21-31`

Pros:

- can reduce payload size further for very large chapters
- may help if you want virtualized verse rendering or partial streaming later

Cons:

- adds a lot of complexity for little phase-1 benefit
- makes continuous audio highlighting and smooth scrolling harder because the active verse may cross data-slice boundaries
- complicates cache coherence and route prefetching

Recommendation: do not slice below chapter level in phase 1 unless measurements prove chapter payloads are too large.

### Recommended normalized layout

Use a compact reference index plus chapter-sharded payloads:

```text
be/data/bible/
  en/
    index.json
    books/
      genesis/
        meta.json
        chapters/
          1.json
          2.json
      psalms/
        meta.json
        chapters/
          1.json
          2.json
```

Where:

- `index.json` contains language-level metadata, book ordering, chapter counts, and availability summary
- `meta.json` contains book-level metadata and optional chapter availability flags
- each chapter JSON contains only the chapter text, ordered verse list, intro audio references, and verse audio references needed for that chapter

This chapter-sharded layout is important not just for client efficiency, but also for backend memory discipline.

### Recommended fetch strategy

1. Load `index.json` once per language and cache it aggressively.
2. Load only the current chapter JSON for first render.
3. Prefetch the next chapter JSON after the current chapter loads.
4. Optionally prefetch the previous chapter JSON for fast backward navigation.
5. Keep the audio playlist embedded in the chapter payload or fetched via a chapter playlist endpoint, but do not require the client to load a whole-book manifest first.

### Recommended chapter payload shape

The chapter API response should be optimized for the reader screen and audio queue without sending redundant book-wide data on every request.

Recommended payload sections:

- lightweight reference metadata
- chapter-level availability and navigation info
- ordered verse records for rendering and playback handoff
- optional intro audio metadata
- next and previous chapter hints for prefetch and smooth transitions

Example shape:

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
  "chapterCount": 50,
  "hasAudio": true,
  "audio": {
    "bookIntro": {
      "path": "/media/bible/en/01-Genesis/01_GEN_00_00.mp3",
      "available": true
    },
    "chapterIntro": {
      "path": "/media/bible/en/01-Genesis/01_GEN_01_00.mp3",
      "available": true
    }
  },
  "verses": [
    {
      "verse": 1,
      "text": "In the beginning God created the heaven and the earth.",
      "hasAudio": true,
      "audioPath": "/media/bible/en/01-Genesis/01_GEN_01_01.mp3"
    }
  ],
  "navigation": {
    "previousChapter": null,
    "nextChapter": {
      "bookId": "genesis",
      "chapter": 2
    }
  },
  "prefetchHints": {
    "nextChapterKey": "en:genesis:2",
    "previousChapterKey": null
  }
}
```

### What should stay out of the chapter payload

Do not include these on every chapter response unless a real use case appears:

- full book lists
- all chapters for the current book with nested verse text
- language catalog for all languages
- duplicated UI labels that can come from the language index
- derived playback state that belongs in the client

### Why this shape is efficient

- first paint gets only what the current screen needs
- the reader can render verses immediately without additional joins
- the player can build a chapter queue directly from the same payload
- next-chapter transition logic has enough metadata without fetching a whole-book document
- repeated navigation metadata stays small and compresses well over HTTP

### Backend serving recommendation

Even if the generated data lives as many JSON files on disk, the frontend should still fetch via backend API endpoints rather than reading raw static JSON files directly.

That gives you:

- stable response contracts
- room for validation and fallback behavior
- easier migration if storage layout changes later
- control over caching headers and compression

Recommended runtime behavior:

- load only the compact language index into backend memory at startup
- do not eagerly load the entire Bible corpus into RAM
- lazily parse chapter JSON files on first request
- retain a bounded in-memory cache for hot chapter payloads
- optionally warm only the default language index and a very small number of hot chapter payloads during boot
- keep the frontend unaware of on-disk JSON layout and only expose stable API contracts

### Recommended backend cache design

Use a layered backend cache strategy:

1. in-memory language index cache
2. in-memory book metadata cache
3. bounded LRU-style chapter payload cache
4. optional precomputed chapter playlist cache derived from the chapter payload

Recommended behavior:

- language index stays resident because it is small and referenced frequently
- book metadata stays resident because it is also compact
- chapter payloads are loaded on demand and evicted when the cache reaches a configured limit
- payload cache entries should store already-parsed JSON objects, not raw file strings, to avoid repeated parse cost on hot paths
- keep cache size configurable by environment so lower-memory deployments can tune it down

Suggested environment knobs:

- `BIBLE_CACHE_MAX_CHAPTERS`
- `BIBLE_CACHE_WARM_LANGUAGES`
- `BIBLE_CACHE_WARM_CHAPTERS`

### Why this is the best fit

- startup stays fast because the backend avoids parsing the full corpus on boot
- hot chapters become cheap after first access
- memory use stays bounded instead of growing with the full Bible dataset
- the client still gets small chapter-sized payloads through stable APIs

### Recommendation summary for efficiency

- generate one large canonical dataset if useful for validation or internal tooling
- do not expose that large dataset directly to the client
- expose a compact language index and chapter-sized runtime payloads
- avoid verse-sliced runtime payloads in phase 1
- optimize for chapter fetch plus adjacent chapter prefetch

## 2. Data Pipeline

Add a one-off and repeatable build script on the backend side, for example `be/scripts/buildBibleManifest.js`, that:

1. imports the requested Bible JSON file for English KJV
2. scans `Waggoner_verses`
3. parses every filename into:
   - `bookIndex`
   - `bookCode`
   - `chapterIndex`
   - `verseIndex`
4. maps those values to canonical book ids
5. classifies audio files as:
   - `bookIntro` when chapter and verse are both `0`
   - `chapterIntro` when verse is `0` and chapter is greater than `0`
   - `verseAudio` when verse is greater than `0`
6. validates verse-level coverage against the Bible JSON text structure
7. emits machine-readable artifacts under a committed or generated data directory, for example:
  - `be/data/bible/en/source-kjv.json` for source text snapshot
  - `be/data/bible/en/index.json` for language and book navigation metadata
  - `be/data/bible/en/books/<bookId>/meta.json` for book-level metadata
  - `be/data/bible/en/books/<bookId>/chapters/<chapter>.json` for runtime chapter payloads
  - `be/data/bible/en/audio-index.json` for audio path lookups
   - `be/data/bible/en/validation-report.json` for gaps and mismatches

### Why this is necessary

- It de-risks runtime parsing.
- It catches filename anomalies before deployment.
- It supports future languages without changing the app shape.
- It gives one clear contract to FE and BE.

## 3. Canonical Identifier Model

Use these stable identifiers internally and in APIs:

- `language`: `en`
- `translationId`: same as language in UI terms, but keep a field for clarity; for now `kjv-en` or `en`
- `bookId`: slug like `genesis`, `1-samuel`, `psalms`
- `chapter`: integer
- `verse`: integer

Use a canonical book metadata table in code or generated JSON with at least:

- `bookIndex` from 1 to 66
- `bookId`
- `name`
- `audioCode` such as `GEN`, `1SA`, `PSA`, `MAT`, `REV`
- `testament`
- `chapterCount`

This metadata should be the only place that knows how Bible JSON book names map to Waggoner audio codes and folder names.

## 4. Backend API Design

Add a dedicated route module such as `be/routes/bible.js` and register it in `be/server.js`.

Recommended endpoints:

### Catalog and navigation

- `GET /api/bible/languages`
  - returns available languages and feature flags
  - example: `[{"id":"en","label":"English","hasText":true,"hasAudio":true}]`

- `GET /api/bible/:language/meta`
  - returns book list, chapter counts, and audio availability summary

- `GET /api/bible/:language/books/:bookId/chapters/:chapter`
  - returns the chapter text plus audio metadata for each verse

- `GET /api/bible/:language/books/:bookId/chapters/:chapter/playlist`
  - returns a playback-oriented payload with ordered verse audio URLs and intro audio when present

### Audio support

- `GET /api/bible/:language/books/:bookId/chapters/:chapter/prefetch`
  - returns the chapter playlist plus neighboring chapter hints for smart preloading

- `GET /api/bible/:language/books/:bookId/chapters/:chapter/verses/:verse/audio`
  - optional proxy endpoint if you want a stable ATP-controlled URL even though media is hosted on `kjv1611only.com`

### Optional utility endpoints

- `GET /api/bible/search?q=faith&language=en`
- `GET /api/bible/:language/progress` and `POST /api/bible/:language/progress`
  - only if user progress later becomes server-backed rather than local-only

### Backend behavior notes

- Reuse `VideoProvider` or extract a more generic media provider abstraction because the same `kjv1611only.com` base URL pattern already exists in the app.
- Prefer generating final absolute media URLs on the backend, not in the frontend.
- Return explicit `hasAudio` booleans at language, book, chapter, and verse levels.
- Return intro audio separately from verse audio so playback order is intentional.

## 5. Do We Need Database Changes?

## Short answer

For the initial Bible reading and audio feature, no database is strictly required if the content is static and user progress remains local-only in the browser.

## Final decision for this feature

Do not ingest the Bible corpus into MariaDB for this feature.

The chosen approach is:

- generated JSON as the canonical Bible text and audio mapping source
- backend API as the only access layer used by the frontend
- in-memory index plus bounded chapter cache on the backend
- no Bible-content DB tables in phase 1

## Why JSON plus backend API wins here

Pros:

- best fit for hierarchical read-heavy content
- easy to shard by language, book, and chapter
- simple and fast chapter fetch path with minimal query overhead
- straightforward to validate against the Waggoner audio corpus at build time
- avoids storing tens of thousands of mostly static verse rows in MariaDB
- easier to version, diff, and regenerate when the source corpus changes
- naturally compatible with CDN, HTTP caching, and service-worker caching

Cons:

- weaker ad hoc querying compared with SQL
- admin-side overrides are less convenient unless you add an overlay layer
- content updates generally happen through regeneration rather than direct edits

## Recommended initial stance

Keep the canonical Bible text and audio manifest as generated JSON artifacts, not DB rows.

That is the simplest design because:

- the corpus is static content, not relational editorial content
- lookup is naturally hierarchical by language, book, chapter, and verse
- the backend already serves as an API façade and can load generated JSON into memory efficiently for fast API responses
- it avoids inserting 31k+ audio rows plus all verse text into MariaDB for no immediate benefit

## Recommendation for this case

For this repo and this feature, the best design is:

- keep Bible text, chapter payloads, and audio mappings in generated JSON files
- load only compact indexes eagerly on the backend
- parse chapters on demand and keep a bounded parsed-object cache
- use backend APIs to serve normalized chapter payloads to the frontend
- keep MariaDB out of the Bible content path entirely

If later you add user accounts, notes, bookmarks, reading plans, or admin tooling, add DB tables for those user and operational concerns without moving the core Bible text corpus unless measurements prove that is necessary.

## When a DB becomes justified

Add DB tables only when one of these becomes a real requirement:

- per-user synced reading progress
- bookmarks, highlights, notes, reading plans
- admin-controlled availability overrides
- analytics beyond coarse request logs
- multi-source audio catalogs managed outside the repository

## DB note for later

If future features need accounts, notes, bookmarks, reading plans, or operational overrides, add DB tables for those features only. Do not move the core Bible text and audio catalog into the DB unless real production measurements show a need.

## 6. Frontend UX Shape

## Primary UX goal

Make the experience feel like a Bible app, not like a sermon archive page with verses bolted on.

## Recommended route structure

- `/bible`
  - redirects to last-opened location or default `en / genesis / 1`
- `/bible/[language]/[book]/[chapter]`
  - main reader screen
- optional shortcut routes:
  - `/bible/[language]`
  - `/bible/[language]/[book]`

## Main screen layout

Build a dedicated reader shell, not a reused video page layout.

Recommended composition:

- sticky top bar with:
  - current reference
  - language selector
  - search or jump action
  - audio play button
- book and chapter selector drawer or modal
- scrollable chapter text with large tap targets per verse
- bottom mini-player when audio is active
- quick next and previous chapter controls

## YouVersion-style navigation principles

- one-tap access to book picker
- one-tap access to chapter picker
- strong last-position memory
- swipe or tap navigation between chapters
- full-screen reading focus with minimal chrome while scrolling
- mini-player persists when browsing books or chapters

## Verse rendering recommendations

- render verse numbers inline but clearly tappable
- allow tap on a verse to start playback from that verse
- auto-highlight the current playing verse while audio is active
- smoothly auto-scroll the active verse into view during playback, but only after playback has been user-initiated
- keep the currently playing verse visually centered when practical rather than pinning it to the extreme top edge
- support a reading mode with larger type and tighter focus

### Active playback behavior

During verse-by-verse audio playback, the reader should behave like a guided reading mode:

- when a verse audio segment starts, mark that verse as active immediately
- keep the highlight in sync with the actual audio queue item, not just optimistic UI timing
- smoothly scroll only when the newly active verse is outside a comfortable viewport window
- avoid fighting manual user scrolling; pause auto-scroll briefly if the user is actively dragging the reader
- resume following playback after the user stops manual scrolling or taps a "follow audio" control

## Language switching

The selector should behave like a version selector but only show one version per language.

Rules:

- switching language keeps the current reference when text exists in the target language
- if audio is unavailable in the selected language, hide audio controls instead of showing disabled clutter
- if a verse or chapter lacks audio, preserve reading mode and show text normally
- show audio availability at the language level before the user enters playback

Example language response contract:

```json
[
  {
    "id": "en",
    "label": "English",
    "translationLabel": "KJV",
    "hasText": true,
    "hasAudio": true
  },
  {
    "id": "es",
    "label": "Spanish",
    "translationLabel": "RVR",
    "hasText": true,
    "hasAudio": false
  }
]
```

## 7. Audio Playback Model

Because the audio files are verse-based, playback should use a chapter playlist assembled from verse files.

Recommended playback order for a chapter:

1. optional book intro when opening the book for the first time in a session
2. optional chapter intro for that chapter
3. ordered verse audio files for the chapter

The player should support:

- play chapter from start
- start from selected verse
- next and previous verse
- next and previous chapter
- automatic smooth continuation into the next chapter when the current chapter playlist finishes
- playback speed controls
- playback timer controls
- background playback on mobile where supported
- wake lock while playing

### Playback controls details

Recommended phase-1 playback controls:

- speed selector with common presets such as `0.75x`, `1x`, `1.25x`, `1.5x`, and `2x`
- persistent preferred speed stored locally in the browser
- sleep timer options such as `15 min`, `30 min`, `45 min`, `60 min`, and `end of chapter`
- clear indication when a sleep timer is active
- timer behavior that stops playback cleanly at the next verse boundary or chapter boundary, depending on the selected mode

For UX consistency, the timer should live in the mini-player or expanded player sheet rather than being hidden in a settings screen.

### Chapter transition behavior

When the last verse in a chapter finishes:

1. preload the next chapter payload if available
2. update route and reader state without a jarring full-page reset
3. smoothly scroll the next chapter into its starting reading position
4. begin playback from next chapter intro or verse 1 based on the intro policy
5. apply active highlight to the first played item in the next chapter

If the user manually started playback from a mid-chapter verse, automatic next-chapter continuation should still happen unless they explicitly disabled continuous play.

## 8. Preloading and Local Caching

## Requirement interpretation

You asked for preloading of the next verse while the current verse is playing, and ideally chapter-chunk preloading with local caching.

The best fit here is:

- precompute a full chapter playlist
- aggressively warm the next 1 to 3 verse audio files immediately
- lazily fetch the remaining verse files of the current chapter in the background
- optionally begin warming the next chapter when the user is near the end of the current one

## Recommended implementation

### Client-side

- add a dedicated Bible audio queue manager in FE, for example `fe/lib/bibleAudioQueue.ts`
- fetch the chapter playlist once
- maintain a normalized queue of verse audio URLs
- begin playback from memory or HTTP cache when possible
- expose the currently active queue item to the reader so verse highlighting and scroll-follow are driven from one playback source of truth
- preload next chapter metadata before the current chapter ends so route transition and highlight handoff stay smooth

### Service worker

Extend `fe/public/sw.js` with a dedicated Bible cache namespace, for example:

- `bible-text-v1`
- `bible-audio-v1`

Recommended caching rules:

- chapter JSON responses: stale-while-revalidate
- chapter playlist responses: stale-while-revalidate
- verse mp3 files: cache-first after first fetch, with LRU eviction policy or size cap

### Cache sizing

Do not attempt to permanently pin the entire Bible audio locally by default.

Instead:

- cache current chapter eagerly
- cache adjacent chapter opportunistically
- evict older chapter audio when storage pressure is detected

### Why chapter-level caching is the right unit

- it matches the reader navigation model
- it reduces request bursts during active playback
- it makes resume behavior simpler
- it avoids huge single-file packaging work when the source corpus is already verse-granular

## 9. Multi-Language Readiness

Even though only English is being added now, structure the app as if language packs are plug-ins.

Each language pack should be able to declare:

- text source path
- translation label
- audio availability
- audio manifest path
- UI text direction if a future language is RTL

Recommended filesystem shape:

```text
be/data/bible/
  en/
    index.json
    source-kjv.json
    books/
      genesis/
        meta.json
        chapters/
          1.json
      exodus/
        meta.json
        chapters/
          1.json
    audio-index.json
  es/
    index.json
    source-rvr.json
    books/
      genesis/
        meta.json
        chapters/
          1.json
```

The UI should never hardcode English-specific assumptions outside display labels.

## 10. Suggested File Additions

### Backend

- `be/routes/bible.js`
- `be/services/bibleService.js`
- `be/services/bibleManifestService.js`
- `be/scripts/buildBibleManifest.js`
- `be/data/bible/en/index.json`
- `be/data/bible/en/source-kjv.json`
- `be/data/bible/en/books/genesis/meta.json`
- `be/data/bible/en/books/genesis/chapters/1.json`
- `be/data/bible/en/validation-report.json`

### Frontend

- `fe/pages/bible/index.tsx`
- `fe/pages/bible/[language]/[book]/[chapter].tsx`
- `fe/components/bible/BibleReaderShell.tsx`
- `fe/components/bible/BookPicker.tsx`
- `fe/components/bible/ChapterPicker.tsx`
- `fe/components/bible/BibleMiniPlayer.tsx`
- `fe/components/bible/VerseList.tsx`
- `fe/hooks/useBible.ts`
- `fe/lib/bibleAudioQueue.ts`

## 11. Validation Rules To Build Into The Import Script

The import/build step should fail or at least emit warnings for:

- missing book folder for a canonical book
- unknown audio code in filenames
- verse audio present for a verse not in the text source
- missing verse audio when the language claims full audio coverage
- duplicate verse audio entries
- book intro or chapter intro files that do not match a known book/chapter
- mismatched chapter numbering width, especially Psalms and any other zero-padded books

## 12. Things You Did Not Explicitly Call Out But Should Be Decided

## Audio intros policy

The Waggoner corpus includes book intro and chapter intro files. Decide whether:

- they auto-play before verse 1
- they are optional toggles
- they are exposed as separate controls

I recommend:

- chapter intro auto-plays when starting from chapter start
- book intro is optional and not replayed repeatedly during the same session

## Search scope

Decide whether Bible search is needed in phase 1.

I recommend:

- no full Bible search in phase 1
- keep the initial scope on reading, navigation, and playback

## Progress persistence

Phase 1 should store reading position in browser localStorage, not in the backend database.

Recommended persisted fields:

- `language`
- `bookId`
- `chapter`
- `verse`
- `playbackMode` such as text-only or audio-active
- `followAudio` to remember whether auto-follow scrolling is enabled
- `playbackSpeed`
- `sleepTimerPreference` if you want to remember the user's most recent timer choice
- `updatedAt`

Move this to DB only later if user accounts and cross-device sync become real requirements.

## Offline policy

Decide whether this is best-effort offline or explicit download-for-offline.

I recommend:

- best-effort cached chapters first
- explicit offline downloads only later, because storage management and UX become much more complex

## SEO policy

Decide whether chapter pages should be indexed.

I recommend:

- allow indexing for chapter text pages if this is a public Bible reading surface
- keep heavy audio preload logic client-side so SSR remains lightweight

## 13. Suggestions

1. Keep Bible content out of MariaDB in phase 1. Generated JSON plus API adapters are simpler and safer.
2. Add a build-time validation report before writing any UI. The data contract is the risky part here, not the reader chrome.
3. Treat `00` files as first-class metadata, not edge-case leftovers.
4. Do not derive canonical book identity from folder names. Use explicit book metadata.
5. Extend the existing service worker instead of inventing a separate offline mechanism.
6. Start with chapter-level caching, not full-book caching. It matches usage and avoids storage blowups.
7. Add a feature flag for the Bible surface so rollout can happen before every language is ready.

## 14. Phased Implementation Plan

### Phase 1: Data contract

- import English KJV JSON
- scan and normalize Waggoner audio files
- generate manifest and validation report
- define API payloads

### Phase 2: Backend API

- add Bible routes and services
- expose language, metadata, chapter, and playlist endpoints
- generate stable media URLs through backend logic

### Phase 3: Reader UI

- build Bible reader page
- add book and chapter pickers
- add verse highlighting and mini-player
- add language selector and local progress memory

### Phase 4: Smart caching

- extend service worker for Bible text and audio caches
- preload remaining current chapter during playback
- warm next chapter near chapter end

### Phase 5: Hardening

- handle missing audio gracefully
- add coverage tests for manifest generation
- add playback tests for chapter queues
- decide on indexing, analytics, and future languages

## Recommendation Summary

The cleanest phase-1 architecture is:

- Bible JSON as canonical text source
- generated manifest from `Waggoner_verses` as canonical audio source
- Express `bible` API backed by generated JSON files, not DB rows
- dedicated Next.js Bible reader route with book and chapter pickers
- service-worker-backed chapter caching and verse queue playback
- language-aware contracts from day one, with only `en` enabled initially

That gives you a stable foundation for English now without boxing the project into English-only assumptions later.