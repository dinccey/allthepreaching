# KJV Bible Reading + Audio Implementation Plan

## Objective

Implement a Bible reading and audio experience for ALLthePREACHING using:

- generated JSON as the canonical Bible content source
- backend APIs as the only frontend access layer
- chapter-sized payloads with bounded backend caching
- English first, with multi-language-ready contracts
- verse-synced audio playback with active highlighting, smooth follow-scroll, continuous chapter playback, speed controls, and a sleep timer

## Final Technical Direction

### Storage and runtime model

- do not ingest Bible content into MariaDB
- generate normalized JSON artifacts from Bible JSON plus Waggoner audio files
- load the language index into backend memory at startup
- lazily parse chapter JSON files on demand
- keep a bounded in-memory cache of parsed chapter payloads
- expose stable backend APIs that hide file layout from the frontend

### Runtime fetch model

- frontend fetches one chapter payload at a time
- frontend prefetches adjacent chapters through the backend API
- frontend audio queue is built from chapter payload data
- service worker caches chapter responses and verse audio progressively

## Deliverables

## 1. Data pipeline deliverables

- normalized book metadata table for 66 books
- English source text snapshot from the selected Bible JSON source
- generated language index JSON
- generated per-book metadata JSON
- generated per-chapter JSON payloads
- generated audio index JSON
- generated validation report JSON

## 2. Backend deliverables

- Bible route module
- Bible service layer
- chapter cache layer
- manifest build script
- API response contracts for languages, metadata, and chapter payloads

## 3. Frontend deliverables

- Bible item in the main navigation
- Bible landing route
- Bible reader page route
- reader shell UI
- book picker
- chapter picker
- verse list with active highlighting
- mini-player or expanded player controls
- chapter prefetch logic
- local progress and playback preference persistence
- reusable shared UI and data components extracted where appropriate

## 4. Offline and caching deliverables

- service worker updates for Bible chapter payload caching
- service worker updates for verse audio caching
- bounded chapter prefetch behavior
- graceful fallback when cached data is unavailable

## 5. Validation deliverables

- manifest generation checks
- API contract checks
- playback behavior checks
- chapter transition checks
- cache behavior checks

## Phase 0: Define Contracts And Metadata

### Goal

Lock the identifiers and metadata before building runtime code.

### Tasks

1. Create canonical book metadata with fields:
   - `bookIndex`
   - `bookId`
   - `name`
   - `audioCode`
   - `testament`
   - `chapterCount`
2. Decide the default English identifiers:
   - `language = en`
   - `translationLabel = KJV`
3. Define API contracts for:
   - `GET /api/bible/languages`
   - `GET /api/bible/:language/meta`
   - `GET /api/bible/:language/books/:bookId/chapters/:chapter`
4. Define cache configuration defaults for backend and service worker.

### Output

- agreed metadata schema
- agreed API response shapes
- agreed cache environment variables

## Phase 1: Build The Normalization Pipeline

### Goal

Generate runtime-ready Bible data from source text and audio files.

### Files to add

- `be/scripts/buildBibleManifest.js`
- `be/services/bibleManifestService.js`
- `be/data/bible/en/index.json`
- `be/data/bible/en/source-kjv.json`
- `be/data/bible/en/books/<bookId>/meta.json`
- `be/data/bible/en/books/<bookId>/chapters/<chapter>.json`
- `be/data/bible/en/audio-index.json`
- `be/data/bible/en/validation-report.json`

### Implementation tasks

1. Import the chosen Bible JSON source for English.
2. Normalize book names from the source text into canonical `bookId` values.
3. Scan `Waggoner_verses` recursively.
4. Parse every audio filename into:
   - `bookIndex`
   - `bookCode`
   - `chapterIndex`
   - `verseIndex`
5. Classify each audio file as:
   - `bookIntro`
   - `chapterIntro`
   - `verseAudio`
6. Validate the parsed audio against canonical book metadata.
7. Build per-chapter payloads containing:
   - chapter reference metadata
   - chapter intro audio if present
   - book intro audio reference if relevant
   - ordered verse objects with text and audio info
   - previous and next chapter hints
8. Emit a validation report with warnings and hard failures.

### Required validation rules

- missing canonical book
- unknown audio code
- duplicate verse audio file
- verse audio without matching verse text
- missing verse audio in a language marked as full-audio
- mismatched padding such as Psalms three-digit segments
- invalid intro file references

### Acceptance criteria

- generation completes successfully for English
- per-chapter JSON files are emitted for all 66 books
- validation report is readable and actionable
- a sample of known files such as Genesis, Psalms, and Revelation map correctly

## Phase 2: Backend API And Cache Layer

### Goal

Serve normalized Bible data through compact, stable APIs with bounded memory usage.

### Files to add or update

- `be/routes/bible.js`
- `be/server.js`
- `be/services/bibleService.js`
- optional `be/services/bibleCacheService.js`

### Implementation tasks

1. Add `be/routes/bible.js` and register it in `be/server.js`.
2. Build a `bibleService` that can:
   - load the language index into memory
   - load book metadata
   - load and parse a chapter payload on demand
   - return normalized API objects
3. Add a bounded in-memory cache for parsed chapter payloads.
4. Add configurable cache settings, for example:
   - `BIBLE_CACHE_MAX_CHAPTERS`
   - `BIBLE_CACHE_WARM_LANGUAGES`
   - `BIBLE_CACHE_WARM_CHAPTERS`
5. Implement `GET /api/bible/languages`.
6. Implement `GET /api/bible/:language/meta`.
7. Implement `GET /api/bible/:language/books/:bookId/chapters/:chapter`.
8. Return correct cache headers for chapter and metadata responses.
9. Ensure API responses expose only stable contracts, not raw filesystem structure.

### API payload requirements

The chapter endpoint should return:

- language id and translation label
- compact book metadata
- chapter number and chapter count
- intro audio metadata
- ordered verse list
- chapter-level `hasAudio`
- navigation hints for adjacent chapters
- prefetch hints if useful

### Acceptance criteria

- backend starts without loading the entire Bible corpus into RAM
- first chapter request succeeds from disk
- repeated chapter requests hit memory cache
- adjacent chapters can be prefetched cleanly
- invalid book or chapter requests return clear API errors

## Phase 3: Frontend Data Layer

### Goal

Build a clean frontend data layer around the new Bible APIs.

### Files to add

- `fe/hooks/useBible.ts`
- optional `fe/lib/bibleApi.ts`
- optional `fe/lib/bibleStorage.ts`

### Implementation tasks

1. Add a Bible API client wrapper.
2. Add SWR hooks for:
   - language index
   - Bible metadata
   - chapter payload
3. Add helper utilities for:
   - storing last position in localStorage
   - storing playback speed
   - storing follow-audio setting
   - storing sleep timer preference if needed
4. Add prefetch helpers for adjacent chapter requests.

### Acceptance criteria

- chapter data is fetched through one clear hook
- local preferences survive refresh
- adjacent chapter prefetch can be triggered from the reader layer

## Phase 4: Reader Routes And UI Shell

### Goal

Build the main Bible reading experience.

### Files to add

- `fe/pages/bible/index.tsx`
- `fe/pages/bible/[language]/[book]/[chapter].tsx`
- `fe/components/bible/BibleReaderShell.tsx`
- `fe/components/bible/BookPicker.tsx`
- `fe/components/bible/ChapterPicker.tsx`
- `fe/components/bible/VerseList.tsx`
- `fe/components/bible/BibleMiniPlayer.tsx`

### Files to update

- `fe/components/Header.tsx`
- any shared layout, control, or list components that can be generalized cleanly

### Implementation tasks

1. Add `/bible` landing route that restores the last-opened reference.
2. Add `/bible/[language]/[book]/[chapter]` reader route.
3. Add a `Bible` item to the main site navigation.
4. Reuse the existing navigation styling and active-link patterns so the new entry feels native to the current app.
5. Build a sticky reader header with:
   - current reference
   - language selector
   - book and chapter navigation actions
   - audio play action
6. Build a book picker with quick book navigation.
7. Build a chapter picker for the selected book.
8. Render verses with:
   - inline verse numbers
   - tap-to-play support
   - active verse highlight state
9. Add next and previous chapter actions.
10. Review existing UI components and extract reusable primitives when the Bible reader needs behavior already present elsewhere, for example:
   - sticky page headers
   - segmented controls
   - modal or drawer shells
   - list item patterns
11. Avoid duplicating logic already present in current hooks or utility modules; extend shared helpers where the abstraction remains clean.

### Acceptance criteria

- `Bible` appears in the site nav and routes correctly
- reader opens directly to a chapter
- book and chapter switching is fast and intuitive
- selected verse can start playback from that verse
- last-opened reference restores after refresh
- new Bible UI code is componentized and does not unnecessarily duplicate existing layout or utility logic

## Phase 5: Audio Queue, Highlighting, And Auto-Follow

### Goal

Make text reading and verse audio playback stay in sync.

### Files to add

- `fe/lib/bibleAudioQueue.ts`
- optional `fe/hooks/useBiblePlayback.ts`

### Implementation tasks

1. Build a chapter-based audio queue from the chapter payload.
2. Support playback start modes:
   - full chapter
   - from selected verse
3. Track the currently active queue item.
4. Bind active queue item to verse highlight state.
5. Smoothly scroll the active verse into view when needed.
6. Avoid fighting manual user scroll:
   - suspend auto-follow briefly if the user scrolls manually
   - resume on explicit follow action or after inactivity
7. Continue automatically into the next chapter when playback reaches chapter end.
8. Handle book intro and chapter intro according to the chosen policy.

### Acceptance criteria

- active verse highlight matches the verse being played
- scroll-follow feels smooth and not jumpy
- next chapter begins without a full reader reset
- mid-chapter playback still transitions correctly into the next chapter

## Phase 6: Playback Controls

### Goal

Add the required player controls for real listening use.

### Implementation tasks

1. Add playback speed controls with presets:
   - `0.75x`
   - `1x`
   - `1.25x`
   - `1.5x`
   - `2x`
2. Persist the selected speed in localStorage.
3. Add a sleep timer UI with options such as:
   - `15 min`
   - `30 min`
   - `45 min`
   - `60 min`
   - `end of chapter`
4. Show when a timer is active.
5. Stop playback cleanly according to the selected timer mode.

### Acceptance criteria

- playback speed changes take effect immediately
- speed preference persists across sessions
- sleep timer stops playback predictably
- timer state is visible to the user

## Phase 7: Service Worker And Local Caching

### Goal

Improve responsiveness and reduce repeated network fetches.

### Files to update

- `fe/public/sw.js`

### Implementation tasks

1. Add a dedicated cache namespace for Bible text responses.
2. Add a dedicated cache namespace for Bible audio responses.
3. Cache chapter API responses using stale-while-revalidate.
4. Cache verse audio files using cache-first after the first successful fetch.
5. Add bounded cache behavior or versioned invalidation.
6. Prefetch the next chapter JSON after the current chapter is loaded.
7. Warm the next few verse files when audio playback is active.

### Acceptance criteria

- revisiting a chapter feels faster after first load
- current chapter audio does not re-fetch unnecessarily
- adjacent chapter transitions are smoother after prefetch

## Phase 8: Hardening And Validation

### Goal

Make the feature resilient before rollout.

### Tests and checks

1. Manifest generation checks for:
   - Genesis mapping
   - Psalms three-digit parsing
   - Revelation tail-end mapping
2. Backend API checks for:
   - valid chapter fetch
   - invalid reference handling
   - cache hit behavior
3. Frontend behavior checks for:
   - opening a chapter
   - switching language
   - starting playback from a verse
   - active highlight updates
   - smooth next chapter transition
4. Playback controls checks for:
   - speed persistence
   - timer stop behavior
5. Caching checks for:
   - chapter response reuse
   - verse audio reuse

### Rollout safeguards

1. Add a feature flag for the Bible surface.
2. Keep the route hidden from the main nav until core playback is stable.
3. Enable English only in the first rollout.

## Suggested Build Order

1. Phase 0 metadata and contracts
2. Phase 1 normalization pipeline
3. Phase 2 backend APIs and bounded cache
4. Phase 3 frontend data hooks
5. Phase 4 reader route and shell
6. Phase 5 audio sync and active verse behavior
7. Phase 6 playback controls
8. Phase 7 service worker caching
9. Phase 8 hardening and rollout

## Suggested Task Breakdown By Area

### Backend

- generate normalized Bible data
- load language index at startup
- implement bounded chapter cache
- expose chapter and metadata APIs

### Frontend

- add the Bible nav entry using existing site navigation patterns
- build reader routes and shell
- fetch chapter payloads via hooks
- implement audio queue and active verse sync
- persist local reading and playback preferences
- refactor or extract reusable components where the current codebase already has overlapping patterns

### Platform and caching

- extend service worker caches
- tune backend chapter cache limits
- verify response sizes and warm-path behavior

## Risks To Watch Early

1. Audio mapping edge cases around intro files and non-uniform zero-padding.
2. Overly large chapter payloads if redundant metadata is included.
3. Janky auto-scroll if follow behavior does not respect manual scrolling.
4. Memory growth if the backend chapter cache is unbounded.
5. Cache inconsistency if service worker and backend payload versions diverge.

## Definition Of Done

The feature is ready for initial testing when:

- English Bible chapter payloads are generated successfully
- backend chapter APIs are stable and cached
- reader UI can open any chapter
- verse playback highlights the active verse correctly
- auto-follow scrolling behaves smoothly
- continuous playback moves into the next chapter
- speed controls and sleep timer work
- local progress restores correctly after refresh
- service worker caching improves repeat usage without breaking correctness