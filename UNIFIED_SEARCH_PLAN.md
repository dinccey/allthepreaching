# Unified Search Bar — Design Plan

> All features listed below are backed by existing Postgres capabilities and indexes already in the schema (`001_init.sql`). Nothing requires an external search service.

---

## Current State (the problem)

| Component | Location | Query param | What it searches |
|---|---|---|---|
| `SearchBar.tsx` | Header/nav | `?q=` | Video titles, preachers, categories via `search_document` GIN index |
| `DualSearchBar.tsx` top input | Hero | `?search=` | Same as above |
| `DualSearchBar.tsx` bottom input | Hero | `?advanced-search=` | Caption cues via `subtitle_documents.text` tsvector GIN index |

Users must understand which box does what. Goal: **one smart search bar** that does all of the above, with a mode toggle and optional advanced filters.

---

## Proposed URL Schema (backward-compatible)

```
/search?q=<term>                            → video FTS (same as today's ?q= and ?search=)
/search?q=<term>&mode=subtitles             → caption FTS only
/search?q=<term>&mode=all                   → both (new default when mode omitted)
/search?q=<term>&preacher=<exact-name>      → filter by preacher
/search?q=<term>&category=<slug>            → filter by category
/search?q=<term>&lang=en                    → filter by language
/search?q=<term>&from=2020-01-01&to=2024-12-31  → date range
/search?q=<term>&maxDuration=60             → max video duration (minutes)
/search?q=<term>&shorts=1                   → shorts only
```

---

## UI Design

```
┌──────────────────────────────────────────────────────────────┐
│  🔍  Search sermons, topics, scripture…               [⌕]    │
└──────────────────────────────────────────────────────────────┘
   [ All ] [ Videos ] [ Captions ]      [Filters ▾]
   Active: Preacher: Shelley ×   Language: English ×
```

- **Mode pills** (All / Videos / Captions) — map to `mode` URL param
- **Filters panel** (collapsible) — autocomplete inputs + chips
- **Active filters bar** — removable tags for set filters

---

## Feature Matrix — Postgres Backing & Complexity

### Core Search Modes

| Feature | Postgres backing | Index used | Complexity |
|---|---|---|---|
| Video FTS | `search_document @@ websearch_to_tsquery('simple', $1)` | `videos_search_document_gin_idx` GIN | **Easy — already works** |
| Caption FTS | `to_tsvector('simple', sd.text) @@ websearch_to_tsquery('simple', $1)` | `subtitle_documents_text_tsvector_gin_idx` GIN | **Easy — already works** |
| **All mode** (combined) | Two queries + merge by `video_pk` server-side or client-side | Both GIN indexes above | **Easy** (2 parallel queries, deduplicate) |

### Filters (on Video Search)

| Filter | SQL clause | Index | Complexity |
|---|---|---|---|
| Preacher | `AND vid_preacher = $N` | `videos_vid_preacher_idx` B-tree | **Easy** |
| Category | `AND vid_category = $N` | `videos_vid_category_idx` B-tree | **Easy** |
| Language | `AND language = $N` | `videos_language_idx` B-tree | **Easy** |
| Date range | `AND published_at BETWEEN $from AND $to` | `videos_published_at_desc_idx` B-tree | **Easy** |
| Max duration | `AND runtime_minutes <= $N` | no dedicated index (post-FTS filter is fast enough) | **Easy** |
| Shorts only | `AND shorts = true` | no dedicated index (boolean, small selectivity) | **Easy** |

### Filters (on Caption Search)

All the same filters work on `subtitle_documents` using its mirrored columns:

| Filter | SQL clause | Index |
|---|---|---|
| Preacher | `AND sd.author ILIKE $N` | `subtitle_documents_author_trgm_idx` GIN/trgm |
| Category | `AND sd.category_slug = $N` | `subtitle_documents_video_pk_idx` (via join) |
| Language | `AND sd.language = $N` | no index — add one if needed |
| Date range | `AND sd.video_date BETWEEN $from AND $to` | no index — add one if needed |

> Two simple `CREATE INDEX` statements cover the remaining caption filter gaps — low effort.

### Autocomplete / Suggestions

| Feature | SQL | Index | Complexity |
|---|---|---|---|
| Preacher autocomplete | `SELECT DISTINCT vid_preacher FROM videos WHERE vid_preacher ILIKE $1 || '%' LIMIT 10` | `videos_vid_preacher_idx` B-tree (prefix match) | **Easy** |
| Category autocomplete | `SELECT DISTINCT vid_category FROM videos WHERE vid_category ILIKE $1 || '%' LIMIT 10` | `videos_vid_category_idx` B-tree | **Easy** |

### "Did You Mean?" (zero-result fallback)

| Feature | SQL | Extension / Index | Complexity |
|---|---|---|---|
| Title similarity | `SELECT vid_title, similarity(vid_title, $1) AS sim FROM videos ORDER BY sim DESC LIMIT 5` | `pg_trgm` (already `CREATE EXTENSION IF NOT EXISTS pg_trgm`) — add `CREATE INDEX ... USING gin (vid_title gin_trgm_ops)` | **Easy** (1 index + 1 query) |
| Preacher similarity | same pattern on `vid_preacher` | same extension | **Easy** |

### Query Syntax Parsing (client-side)

Parsed in JS before submitting, no BE changes:

| Syntax | What it does |
|---|---|
| `"exact phrase"` | Passed as-is to `websearch_to_tsquery` (natively supports phrases) |
| `grace -works` | Passed as-is to `websearch_to_tsquery` (natively supports negation) |
| `grace OR faith` | Passed as-is to `websearch_to_tsquery` |
| `preacher:shelley grace` | Client strips `preacher:shelley`, sets `&preacher=shelley`, sends `grace` as `q` |
| `in:captions grace` | Client strips `in:captions`, sets `&mode=subtitles`, sends `grace` as `q` |
| `in:videos grace` | Client strips `in:videos`, sets `&mode=videos` |

All of this is purely client-side string parsing, zero BE changes.

### Scripture Reference Search

| Feature | SQL | Complexity |
|---|---|---|
| `scripture=John+3:16` | `sd.text ILIKE '%John 3:16%' OR sd.text ILIKE '%John three sixteen%'` | **Medium** — needs reference normalizer + trgm index on `sd.text`; `sd.text` is large so index is expensive |

> **Note**: adding a `gin_trgm_ops` index on `subtitle_documents.text` (millions of rows, long strings) is non-trivial. A dedicated Scripture reference parser that generates multiple ILIKE patterns is the practical path. Not for Phase 1.

---

## Backend Changes Required

### Phase 1 — Zero BE changes
Just swap the components. The existing `/api/search` endpoint already handles `mode`, `q`, `search`, `advanced-search` and `categoryInfo` params.

### Phase 2 — Add filter params to existing search queries
Extend `buildPostgresVideoSearch` and `buildPostgresSubtitleSearch` in `be/routes/search.js` to accept:
- `preacher`, `category`, `lang`, `from`, `to`, `maxDuration`, `shorts`
- Each adds one `AND` clause if the param is present

Estimated: ~50 lines of BE code.

### Phase 3 — Add `/api/search/suggest` endpoint
```js
GET /api/search/suggest?q=shelley&type=preacher
→ ["Steven Anderson", "Jonathan Shelley", …]
```
One query per type, B-tree prefix match. ~30 lines.

### Phase 4 — "All" mode server-side merge
Run both queries in the same request, merge arrays by `video_pk`, sort by rank. ~80 lines.

### Phase 5 — "Did you mean?" fallback
Add trgm index on `vid_title`. When video FTS returns 0 rows, run similarity query, return suggestions in response. ~30 lines.

---

## Component Architecture

```
fe/components/search/
  UnifiedSearchBar.tsx       ← replaces SearchBar + DualSearchBar
  SearchModeToggle.tsx       ← [ All ] [ Videos ] [ Captions ]
  AdvancedFiltersPanel.tsx   ← collapsible, lazy-mounted
  ActiveFiltersBar.tsx       ← removable filter tags
  SuggestionDropdown.tsx     ← autocomplete list
```

`UnifiedSearchBar` accepts a `compact` prop:
- `compact={true}` — header nav: text input + mode toggle only, no advanced panel
- `compact={false}` (default) — hero section: full experience with filters panel accessible

---

## Implementation Phases

| Phase | Work | BE changes | Complexity |
|---|---|---|---|
| **1** | `UnifiedSearchBar` + mode toggle, replace both old components | None | Easy |
| **2** | Add filter params (preacher, category, lang, date, duration, shorts) | ~50 lines in search.js | Easy |
| **3** | Autocomplete endpoint `/api/search/suggest` | ~30 lines | Easy |
| **4** | Combined "All" mode: parallel queries + merge | ~80 lines | Medium |
| **5** | Client-side query syntax (`preacher:`, `in:captions`, etc.) | None | Easy |
| **6** | "Did you mean?" zero-result fallback | ~30 lines + 1 index | Easy |
| **7** | Scripture reference search | ~100 lines + 1 large index | Medium-Hard |


## Problem Statement

Currently there are **three separate search entry points** with different behaviors:

| Component | Location | Query param | What it searches |
|---|---|---|---|
| `SearchBar.tsx` | Header/nav | `?q=` | Video titles, preachers, categories (video FTS via `search_document`) |
| `DualSearchBar.tsx` (top input) | Hero / home | `?search=` | Same as above (category/preacher/title filter) |
| `DualSearchBar.tsx` (bottom input) | Hero / home | `?advanced-search=` | Subtitle/caption full-text (subtitle_documents) |

Users must understand which box does what. The goal: **one smart search bar** that does all of the above — defaulting to "everything", but letting users narrow scope with toggles or query syntax.

---

## Proposed URL Schema

Keep backward-compatible params so existing links keep working:

```
/search?q=<term>                     → video FTS only (as today with ?q=)
/search?q=<term>&mode=subtitles      → subtitle FTS only
/search?q=<term>&mode=all            → both (new default when no mode given)
/search?q=<term>&preacher=<slug>     → filter by preacher
/search?q=<term>&category=<slug>     → filter by category
/search?q=<term>&lang=en             → filter by language
/search?q=<term>&from=2020-01-01&to=2024-12-31  → date range filter
```

The `mode` toggle (Videos / Captions / Both) is exposed as pill buttons below the search bar.

---

## UI Design: Smart Search Bar

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔍  Search sermons, topics, scripture...                      [⌕]  │
└─────────────────────────────────────────────────────────────────────┘
   [ All ] [ Videos ] [ Captions ]    [Advanced ▾]
```

### Mode pills
- **All** (default) — runs video FTS + subtitle FTS in parallel, merges & deduplicates by video_id; subtitles collapse under their parent video
- **Videos** — search `videos.search_document` only (title, preacher, category)
- **Captions** — search `subtitle_documents.text` only (full-text in caption cues), returning cue-grouped results as today

### Advanced panel (collapsible, closed by default)
Clicking `Advanced ▾` reveals filter chips:

| Filter | UI element | Maps to |
|---|---|---|
| Preacher | Autocomplete dropdown | `&preacher=slug` |
| Category | Autocomplete dropdown | `&category=slug` |
| Language | Radio chips (en / es / pt / fr / other) | `&lang=en` |
| Date range | Two date pickers (From / To) | `&from=YYYY-MM-DD&to=YYYY-MM-DD` |
| Duration | Slider (any / short <20m / medium / long >60m) | `&maxDuration=60` |
| Shorts only | Toggle | `&shorts=1` |

Active filters shown as removable tags below the search box.

---

## Advanced Query Syntax (power users)

Expose Postgres `websearch_to_tsquery` syntax naturally:

| Syntax | Meaning |
|---|---|
| `grace alone` | both words |
| `"grace alone"` | exact phrase |
| `grace -works` | grace but not works |
| `grace OR faith` | either word |
| `preacher:shelley grace` | filter preacher via query syntax (parsed client-side, extracted to `&preacher=`) |
| `in:captions grace` | force caption mode |
| `in:videos grace` | force video mode |

The client parses `preacher:`, `category:`, `in:` tokens before submitting, strips them from the text query, and maps them to URL params. The text remainder is sent to the BE as `q=`.

---

## Backend Changes Required

### 1. New `/api/search` combined mode
When `mode=all` (or no mode), run both queries in parallel:
- `buildPostgresVideoSearch` for `videos.search_document`
- `buildPostgresSubtitleSearch` for `subtitle_documents`

Merge: deduplicate by `video_id`, attach subtitle cues as a sub-array under each video result. Sort by max(rank_score).

### 2. Preacher / category / language / date range filters on video search
Extend `buildPostgresVideoSearch` to accept optional filters:
```sql
AND vid_preacher ILIKE $N          -- preacher filter
AND vid_category = $N              -- category filter
AND language = $N                  -- language filter
AND published_at BETWEEN $N AND $N -- date range
AND runtime_minutes <= $N          -- max duration
AND shorts = $N                    -- shorts only
```

### 3. Autocomplete endpoint
`GET /api/search/suggest?q=shelley&type=preacher|category`
Returns top 10 matching preacher names or category names from the videos table (simple ILIKE).

---

## Component Architecture

```
components/
  search/
    UnifiedSearchBar.tsx      ← new: replaces SearchBar + DualSearchBar
    SearchModeToggle.tsx      ← [ All ] [ Videos ] [ Captions ] pills
    AdvancedFiltersPanel.tsx  ← collapsible advanced filters
    ActiveFiltersBar.tsx      ← removable filter tags
    SuggestionDropdown.tsx    ← autocomplete list
```

`UnifiedSearchBar` replaces both `SearchBar` (in `Header.tsx`) and `DualSearchBar` (in `HeroSection.tsx`). Both get a `compact` prop: the header variant shows only the text input + mode toggle; the hero variant defaults to expanded with the advanced panel accessible.

---

## Search Results Page Changes

- **All mode**: show video cards, each optionally expanded to show matching caption snippets inline (collapsed by default, "Show X caption matches ▾")
- **Videos mode**: current video card grid (unchanged)
- **Captions mode**: current `SubtitlesResultCard` grid (unchanged)
- Active filters bar above results: `Preacher: Shelley ×  Language: English ×`

---

## Advanced Features Worth Adding

### A. "Did you mean?" / spell correction
Use `pg_trgm` similarity on titles/preachers when FTS returns zero results:
```sql
SELECT vid_title, similarity(vid_title, $1) AS sim
FROM videos ORDER BY sim DESC LIMIT 5
```
Return as suggestions when the main query finds nothing.

### B. Related sermons
On the video detail page, after a caption search lands on a video, show "Similar sermons" using `ts_rank` on the same query against other videos.

### C. Scripture search
`/search?scripture=John+3:16` — parses the reference, maps it to a set of subtitle cue patterns (e.g. `"John 3:16"`, `"John three sixteen"`), runs as a phrase FTS query. Could be a dedicated chip in the advanced panel.

### D. "Search within preacher"
On a preacher's page (`/preacher/[slug]`), the search bar pre-fills `preacher:slug` and searches only their sermons. This reuses the same UnifiedSearchBar with a locked preacher filter.

### E. Saved searches / bookmarks (future)
LocalStorage-backed list of recent searches. Shown as chips under the search bar when focused.

---

## Implementation Phases

| Phase | Work | Complexity |
|---|---|---|
| **1** | Create `UnifiedSearchBar` with text input + mode toggle (All/Videos/Captions), replace `SearchBar` + `DualSearchBar` | Low |
| **2** | Add collapsible advanced filters panel (preacher, category, language) | Medium |
| **3** | BE: add filter params to video search query; add `/api/search/suggest` endpoint | Medium |
| **4** | "All" mode: parallel queries + merged results with inline caption snippets | Medium-High |
| **5** | Query syntax parsing (`preacher:`, `in:captions`, etc.) | Medium |
| **6** | "Did you mean?" via pg_trgm fallback | Low |
| **7** | Scripture reference search | High |

Phase 1 can ship independently without any BE changes.
