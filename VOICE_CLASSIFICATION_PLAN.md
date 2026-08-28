# Voice-Based Classification — Research & Refactor Plan

> **Status: RESEARCH PHASE ONLY** — no code has been changed. This document captures
> (a) how classification works today, (b) open-source voice-recognition options
> (licensing verified), (c) a proposed architecture for voice-first, multi-category
> classification with human approval, and (d) a phased rollout.

Date: 2026-08-28

---

## 1. Executive Summary

- **Today**, video classification is purely metadata-driven: an LLM picks a "profile"
  (preacher/category) from `title + uploader + channel + duration` in ATP-manager-aio
  stage 2. When the channel uploads other preachers, titles are generic, or metadata is
  wrong, classification fails → video lands in "Other" or a staging profile.
- **Proposed**: add a **voice signature (speaker-embedding) layer** that classifies
  videos by *who is actually speaking*. Voice becomes the **primary** signal; metadata/LLM
  remains the fallback. A video can carry a **primary category** plus **auxiliary
  categories** for additional speakers (interviews, guest speakers, panel sermons).
- **Recommended open-source stack** (all permissive licenses, verified below):
  - **Embeddings ("voice signatures")**: 3D-Speaker **CAM++** (Apache-2.0 code *and*
    weights; 0.65% EER on VoxCeleb1; 7.2 M params — fast on CPU) — with SpeechBrain
    **ECAPA-TDNN** (Apache-2.0) as validated alternative.
  - **Diarization ("who spoke when", needed for multi-voice videos)**:
    **pyannote.audio 3.1** (MIT code, MIT-licensed pretrained pipeline, ~40–50× realtime
    on GPU). DiariZen is more accurate but its weights are CC-BY-NC (non-commercial).
- **Corpus scale**: ~16,193 live videos, ~**18,000 hours** of audio, 290 category slugs,
  268 preachers. Whole-corpus embedding is cheap (CPU-feasible in hours); full
  diarization is expensive — so the design runs diarization **on demand**, not for every video.
- **Human-in-the-loop is already a pattern here** (profile staging + "Apply Profile"
  review in ATP-manager-aio). Voice enrollment and new-voice detection extend the same
  approval workflow rather than inventing a new one.
- **Schema**: normalize categories/preachers into `categories` + `profiles` tables with
  M2M joins to videos (primary + auxiliary roles per video, §4.2); legacy
  `vid_category` / `vid_preacher` columns stay trigger-synced throughout migration so
  mirrors and the ATP pipeline keep working.
- **Bootstrap**: sample ~10 videos per profile and majority-vote the dominant voice
  into a *proposed* enrollment, then human approval; the minority outliers surface
  misclassified videos immediately (§5 Phase 1).

---

## 2. Current State (as-is)

### 2.1 The two systems involved

| System | Role |
| --- | --- |
| `ATP-manager-aio` (Python/Flask dashboard) | Ingestion pipeline: RSS → download → metadata + **LLM profile match** → SQL → Postgres insert |
| `allthepreaching` (`be/` Node/Express + `fe/` Next.js + Postgres) | Public site + database: browse/filter videos by category & preacher |

### 2.2 ATP-manager-aio pipeline (stages)

| Stage | What it does | Classification relevance |
| --- | --- | --- |
| 0 | RSS/Rumble link fetching | — |
| 0.5 | yt-dlp metadata (title, uploader, channel, description, duration) | **Input metadata** |
| 1 | Download, transcode, thumbnail, **generates MP3 companion** (`stage1.py::generate_mp3`) | Audio already extracted next to every video |
| **2** | **LLM profile matching** (`stage2.py::_decide_profile_and_rename` → `llm_helper.match_profile`) | **The classification decision today** |
| 3 | Build SQL files | — |
| 4 | SSH transfer | — |
| 5 | Insert into Postgres `videos` table | — |

Stage 2 decision logic (all text, no audio):

1. LLM is given `{title, uploader, video_length_minutes}` + a profile list
   (via ChromaDB `search_profiles` tool call, `profile_vectorstore.py`).
2. LLM returns a `profile_id` (or "Other").
3. If "Other"/no match → second LLM call extracts a preacher name from the title →
   creates a **staged** profile pending **human approval** (`atp_profiles_staging.json`).
4. LLM then generates a clean title + detects language.
5. On failure → profile `Other` (`12other`), `vid_preacher: "Unknown"`.

**Profiles** = `atp_profiles.json`: `profile_key → {precedence_priority, category_id
(fs slug, e.g.`fsmejia`), search_category, fs_path, vid_preacher, main_category,
naming_instruction, …}`. The "Apply Profile" UI feature allows manual re-assignment of
finished videos (updates profile fields + paths + SQL params).

### 2.3 allthepreaching schema (Postgres, `be/sql/postgres/001_init.sql`)

```sql
create table if not exists videos (
  id integer primary key,
  vid_category text,        -- slug, e.g. 'fsmejia'   ← THE category (single-valued)
  search_category text,     -- human name, e.g. 'Sermons Pastor Mejia'
  vid_preacher text,        -- human name, e.g. 'Pastor Bruce Mejia' (single-valued)
  name text, vid_title text, vid_code text,
  date text, published_at date,
  vid_url text, thumb_url text, pic_url text, header_url text,
  video_id text,            -- source YouTube/Rumble id
  profile_id text,          -- ATP-manager profile key
  main_category text,
  created_at timestamptz, updated_at timestamptz,
  clicks integer not null default 0,
  shorts boolean not null default false,
  language varchar(10) not null default 'en',
  runtime_minutes numeric(8,2),
  search_document tsvector
);
```

Category/preacher are **columns on `videos`, not separate entities** — there is no
categories table and no profile↔video join table. Everything derives from
`vid_category` / `vid_preacher`:

- `be/routes/categories.js` — `GROUP BY vid_category` (counts + autocomplete),
  `/api/categories/:name` lists `WHERE vid_category = ?`.
- `be/routes/preachers.js` — `GROUP BY vid_preacher`.
- `be/routes/videos.js` — `?category=` / `?preacher=` filters are exact single-value
  matches (`buildVideoFilters`).
- `be/routes/rss.js` — feeds filter by the same single values.
- FE: `fe/pages/videos.tsx` (category filter dropdown from `/api/categories`),
  `fe/pages/preacher/[slug].tsx`, `fe/pages/video/[id].tsx` shows one category link +
  one preacher. `search_category` is used for FTS weighting.

**Side finding:** `fe/pages/video/[id].tsx` (line ~335) and `Footer.tsx` link to
`/category/<slug>`, but **no `fe/pages/category/` route exists** — those links currently
404 (categories are only browsable via `/videos?category=`). The refactor should add the
category page anyway.

### 2.4 Scale & existing audio infrastructure (verified live, 2026-08-28)

| Fact | Value | Source |
| --- | --- | --- |
| Live videos | **16,193** | `api.allthepreaching.com/api/videos` |
| Category slugs | **290** | `/api/categories` |
| Preachers | **268** | `/api/preachers` |
| Avg runtime | **66.7 min** (median 76.2) | sample of 96 |
| **Estimated corpus** | **~18,000 hours of audio** | 16,193 × 66.7 min |
| Audio per video | MP3 companion auto-generated in stage 1 | `stage1.py::generate_mp3` |
| Existing STT | `distributed_batch_stt` (whisper.cpp, client/server, CPU **or CUDA** backends) producing VTT captions | repo + build script |
| Captions in DB | `subtitle_documents` (per-cue rows, FTS-indexed) | `001_init.sql` |
| Human-approval pattern | Profile staging queue + "Apply Profile" UI in ATP-manager | `models.py`, `routes.py` |
| Existing vector infra | ChromaDB (`atp_profiles` collection) for LLM profile search | `profile_vectorstore.py` |

Implication: **audio is already present next to every video**, captions already exist,
and an approval workflow already exists. The voice layer mostly plugs in.

---

## 3. Voice Recognition Research (open source, licensing verified)

### 3.1 Task decomposition

The feature needs two distinct capabilities:

1. **Speaker embedding / verification** — reduce a person's voice to a fixed-length
   vector ("voice signature"); compare vectors by cosine similarity. This answers
   *"is this one of our known preachers?"* and *"which known one?"* (1:N against the
   enrolled gallery).
2. **Speaker diarization** — segment a recording into per-speaker turns. Needed to
   handle **"the voice is not the only voice in the video"** → multiple categories.

### 3.2 Candidate systems

| System | Code license | Pretrained weights license | Accuracy | Notes |
| --- | --- | --- | --- | --- |
| **3D-Speaker** (Alibaba/DAMO, `modelscope/3D-Speaker`) | **Apache-2.0** | **Apache-2.0** (verified via ModelScope API for `iic/speech_campplus_sv_zh-cn_16k-common`) | **CAM++ 0.65% EER** (VoxCeleb1 O); ERes2NetV2 0.61%; ERes2Net-large 0.52% | Full toolkit: SV + diarization (VAD, segmentation, embedding, clustering, overlap). CAM++ = 7.2 M params, designed to be faster/cheaper than ECAPA. Python API: `modelscope` pip or `speakerlab` in-repo. Also available via FunASR (`funasr/campplus`, HF, Apache-2.0). |
| **SpeechBrain** `spkrec-ecapa-voxceleb` | Apache-2.0 | **Apache-2.0** (verified via HF API; ~1.8 M downloads) | ECAPA-TDNN, **0.80% EER** (VoxCeleb1 cleaned, trained on VoxCeleb1+2) | Simple Python API: `EncoderClassifier.from_hparams(...).encode_batch(signal)`; `SpeakerRecognition.verify_files(a,b)`. 16 kHz mono. Solid fallback / A-B comparison target. |
| **pyannote.audio 3.1** | **MIT** | **MIT** (model card `license: mit`; HF gating is a contact form only) | Diarization DER: **VoxConverse 11.3%**, AMI 18.8%, AISHELL-4 12.2% | De-facto SOTA open diarization. Pure PyTorch in 3.1 (no onnxruntime issues). GPU: **~40–53× realtime** (maintainer benchmarks); 25-min file ≈ 20 s on a good GPU. 16 kHz mono input; outputs RTTM/Annotation; supports known `num_speakers` hints. |
| **DiariZen** (BUT Speech) | MIT | **CC-BY-NC-4.0** (non-commercial weights) | Beats pyannote: VoxConverse **9.1%** vs 11.3% | WavLM-based EEND. Attractive accuracy upgrade, but weights forbid commercial use — revisit later only if needed. |
| **wespeaker** (WeNet) | Apache-2.0 | CC-BY-4.0 (VoxCeleb-trained) | ResNet/x-vector class, weaker than CAM++/ECAPA | Usable but no advantage over the above. |
| **whisperX** | BSD-2 | bundles pyannote (MIT) + faster-whisper | — | Useful if we later want diarized *transcripts* (word-level + speaker labels) in one tool. Not needed for classification itself. |
| **NVIDIA NeMo** | Apache-2.0 | NVIDIA Open Model License | ECAPA-TDNN/TSP SV + diarization | Heavier ecosystem; no advantage for this use case. |
| **resemblyzer** | MIT | — | 125-d d-vector, circa 2018 | Kept for comparison only; clearly superseded. |

**Accuracy context:** EER is a 1:1 (two speakers) metric. 1:N open-set identification
against a 268-speaker gallery is harder in practice (more false-positive opportunities),
and sermon audio (recorded churches, phone video, elderly speakers, similar-register
speech) is a domain shift from VoxCeleb. **Assume noticeably worse real-world numbers
than the benchmarks** — which is exactly why the design below uses confidence tiers,
top-1/top-2 margins, and human approval instead of hard thresholds on raw scores.

### 3.3 Recommendation

| Role | Pick | Why |
| --- | --- | --- |
| Voice signature | **3D-Speaker CAM++** (primary), SpeechBrain ECAPA (A/B control) | Fully permissive licensing incl. weights; tiny model (CPU-friendly for 18k h corpus); top-tier accuracy; same ecosystem also provides a diarization recipe if we ever want to skip pyannote |
| Diarization | **pyannote 3.1** | MIT everything, SOTA open DER, fast on GPU, well documented; used by whisperX ecosystem so well-trodden |
| Threshold/calibration | Custom, on-domain | Calibrate on our own holdout set (see §7) — never trust benchmark defaults on sermon audio |

---

## 4. Proposed Architecture

```
                       ┌────────────────────────────────────────────┐
                       │  Postgres (allthepreaching DB)             │
                       │  videos (legacy cols trigger-synced)       │
                       │  + categories / profiles (entities)        │
                       │  + video_categories / video_profiles (M2M) │
                       │  + video_speakers (evidence)               │
                       │  + speaker_enrollments (gallery)           │
                       └──────────────▲─────────────────▲───────────┘
                                      │                 │
        new video                     │ approve/inspect │
┌──────────────┐  MP3/MP4  ┌──────────┴───────┐  ┌──────┴──────────┐
│ ATP-manager  │──────────▶│  Voice Service   │  │ allthepreaching │
│ stage 1.5    │  16k wav  │  (Python, torch) │  │ be (Node) + fe  │
│ (ffmpeg 16k) │           │  ┌────────────┐  │  │ (reads joins)   │
└──────┬───────┘           │  │ CAM++      │  │  └─────────────────┘
       │                   │  │ embeddings │  │
       ▼                   │  ├────────────┤  │
┌──────────────┐            │  │ pyannote   │  │
│ Stage 2 LLM  │◀─ voice hint, confidence tiers, contradictions ─┤
│ profile match│            │  │ diarizer   │  │
└──────────────┘            │  └────────────┘  │
                            └──────────────────┘
```

### 4.1 Voice Service (new)

A small Python service (or new module inside ATP-manager-aio — recommended: **separate
service/container**, because it carries torch + models and is long-running; exposes HTTP
API + batch CLI). Responsibilities:

1. **Audio prep** — ffmpeg → 16 kHz mono WAV (from the existing MP3 companion or the
   video file). No re-encoding of the corpus needed.
2. **Whole-audio embedding** — chunked CAM++ extraction (chunks ~20–30 s, overlapping;
   segment embeddings averaged after L2-normalization — standard for long recordings;
   keeps RAM flat and allows progress tracking). Result: one "dominant speaker"
   vector per video.
3. **Speaker-count probe** — fast check whether the video has more than one speaker.
   Two options, cheap→expensive:
   - VAD + segment embedding variance (cheap, no diarization model): if chunk
     embeddings split into two well-separated clusters → multi-speaker suspected.
   - pyannote 3.1 full diarization (accurate; use only when the probe flags, or when
     the whole-audio match is weak/ambiguous).
4. **Per-speaker matching** (multi-speaker path) — diarization segments → per-speaker
   embeddings → each matched against the gallery.
5. **Matching engine** — cosine similarity against the enrolled gallery:
   - `score_top1` = max similarity to any enrolled speaker
   - `margin` = score_top1 − score_top2
   - **Confidence tiers** (calibrated on-domain, §7):
     - **HIGH** (score ≥ T_high AND margin ≥ M) → auto-assign (logged, auditable)
     - **MEDIUM** (score ≥ T_med) → proposed, goes to human review queue
     - **LOW / NO MATCH** → fall back to metadata/LLM classification; the voice is
       recorded as "unknown" and can later seed a *new* profile (see 4.4)
6. **Enrollment** — for a profile, aggregate embeddings from K ≥ 3 approved
   same-speaker videos (drop outliers; store mean reference vector + per-clip vectors
   for audit). Re-enroll when new high-confidence videos accumulate (drift handling).

### 4.2 Data model (normalized target, migrated incrementally)

**Target: normalize what is currently denormalized.** Today category/preacher are
free-text columns on `videos` (`vid_category`, `vid_preacher`, `search_category`,
`main_category`, `profile_id`) and every query `GROUP BY`s those strings. That is why
metadata mistakes scatter everywhere (one typo = one phantom "preacher"), and it
cannot express "two preachers in one video". Migration target:

| New table | Replaces | Notes |
| --- | --- | --- |
| `categories` | distinct `vid_category` + `search_category` | Site-facing groups: preacher pages **and** topic categories (`docs`, `other`) |
| `profiles` | distinct `vid_preacher` + ATP `profile_id` / `atp_profiles.json` key | Preacher/speaker identity; canonical name; home category; voice enrollments attach here |
| `video_categories` (M2M) | `vid_category` column | Video↔category, `is_primary` + `source` (metadata/voice/manual/import) |
| `video_profiles` (M2M) | `vid_preacher` column | Video↔profile, `is_primary` + `source` — the classification truth |
| `video_speakers` | — (new) | Raw voice evidence per detected speaker, including unmatched |
| `speaker_enrollments` | — (new) | Enrolled voice signatures per profile (the gallery) |

Categories and profiles are deliberately separate: today's data already has
non-preacher categories (documentaries: slug `docs`, linked from the footer as
`/category/documentaries`), and a documentary can feature a known preacher
(profile ≠ category). Preachers map 1:1 to a "home" category today
(`profiles.category_id`), so the common case stays one hop.

```sql
create table categories (
  id integer generated always as identity primary key,
  slug text not null unique,            -- 'fsmejia', 'docs', 'other'
  name text not null,                   -- 'Sermons Pastor Mejia' (old search_category)
  sort_order integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id integer generated always as identity primary key,
  profile_key text not null unique,     -- ATP-manager key, e.g. 'Bruce_Mejia'
  name text not null,                   -- canonical display name (old vid_preacher)
  name_slug text not null unique,       -- for /preacher/:slug
  category_id integer references categories(id),  -- home category
  main_category text,                   -- legacy free text, optional
  is_multi_voice boolean not null default false,  -- channel hosting several speakers
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table video_categories (
  video_id integer not null references videos(id) on delete cascade,
  category_id integer not null references categories(id) on delete restrict,
  is_primary boolean not null default false,
  source text not null default 'metadata'
         check (source in ('metadata','voice','manual','import')),
  reviewed_by text, reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (video_id, category_id)
);
create unique index idx_one_primary_category
  on video_categories (video_id) where is_primary;
create index video_categories_category_idx on video_categories (category_id, video_id);

create table video_profiles (
  video_id integer not null references videos(id) on delete cascade,
  profile_id integer not null references profiles(id) on delete restrict,
  is_primary boolean not null default false,
  source text not null default 'metadata'
         check (source in ('metadata','voice','manual','import')),
  confidence text check (confidence in ('high','medium','low')),
  reviewed_by text, reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (video_id, profile_id)
);
create unique index idx_one_primary_profile
  on video_profiles (video_id) where is_primary;
create index video_profiles_profile_idx on video_profiles (profile_id, video_id);

-- raw voice evidence: one row per detected speaker, incl. unmatched
create table video_speakers (
  id bigint generated always as identity primary key,
  video_id integer not null references videos(id) on delete cascade,
  speaker_label text not null,          -- 'S1','S2',... or 'whole'
  pipeline text not null default 'whole_audio',  -- whole_audio | diarized
  speech_ratio double precision,        -- fraction of runtime this speaker holds
  matched_profile_id integer references profiles(id),  -- null = unmatched
  score_top1 double precision,
  score_top2 double precision,
  margin double precision,
  confidence text check (confidence in ('high','medium','low')),
  model_version text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now()
);
create index video_speakers_video_idx on video_speakers (video_id);

-- enrolled voice signatures (gallery; pgvector, or float8[]/jsonb fallback)
create table speaker_enrollments (
  id bigint generated always as identity primary key,
  profile_id integer not null references profiles(id) on delete cascade,
  source_video_id integer references videos(id),
  clip_path text,
  embedding vector(512) not null,
  approved_by text, approved_at timestamptz,
  status text not null default 'pending' check (status in ('pending','active','retired')),
  created_at timestamptz not null default now()
);
create index speaker_enrollments_profile_idx on speaker_enrollments (profile_id);
```

Invariants (the partial unique indexes above):

- exactly one primary category and one primary profile per video;
- auxiliary entries are extra `is_primary = false` rows — that **is** the
  multi-category support;
- `source` preserves provenance for audit and the calibration loop.

**Legacy columns stay, trigger-synced (migration safety net).** Mirrors/clones
(`/api/clone/db`), ATP-manager stage-5 SQL inserts, and every current BE route read
`videos.vid_category` / `vid_preacher` / `search_category` / `profile_id`. So:

1. The join tables are the **source of truth**.
2. A trigger pair keeps the legacy columns as a *derived cache*:
   - `video_categories` / `video_profiles` primary-row change → update
     `videos.vid_category`, `search_category`, `vid_preacher`, `profile_id`;
   - `videos` insert/update of those columns (e.g. stage-5 SQL) → upsert
     `categories` / `profiles` rows + primary join rows when missing.
   - Loop guard: each side writes only when the value actually differs
     (or a session flag `atp.syncing_legacy` set by the sync trigger).
3. The FTS `search_document` trigger keeps reading the legacy columns → unchanged.
4. Only after every consumer (BE routes, mirrors, clone jobs) runs on the joins do
   we drop the legacy columns — final migration, separate release.

**Backfill (16k rows, one-time):**

```sql
insert into categories (slug, name)
select distinct v.vid_category,
       coalesce(nullif(max(v.search_category), ''), v.vid_category)
from videos v where v.vid_category is not null
 group by v.vid_category;

-- profiles: dedup vid_preacher per vid_category (normalize case/space/parens);
-- near-duplicates go to a human merge-review queue (voice similarity can suggest merges)

insert into video_categories (video_id, category_id, is_primary, source)
select v.id, c.id, true, 'import'
from videos v join categories c on c.slug = v.vid_category;

insert into video_profiles (video_id, profile_id, is_primary, source)
select v.id, p.id, true, 'import' from videos v join profiles p on ...;
```

Side benefit: the 268 free-text `vid_preacher` values almost certainly contain
variant spellings of the same person — the `profiles` table + a one-time dedup
review fixes that permanently, and voice similarity *between profiles* can flag
likely duplicates ("these two profiles may be one person" review queue).

**Query migration (BE routes):**

| Route | Today | After |
| --- | --- | --- |
| `GET /api/categories` | `GROUP BY vid_category` | `categories JOIN video_categories` counts (+ optional aux count) |
| `GET /api/categories/:name` | `WHERE vid_category = ?` | `video_id IN (…video_categories…)` (+ include aux) |
| `GET /api/preachers` | `GROUP BY vid_preacher` | `profiles JOIN video_profiles` |
| `GET /api/preachers/:slug` | `WHERE vid_preacher = ?` | join on `profiles.name_slug` |
| `GET /api/videos` filters | `vid_category = ?` / `vid_preacher = ?` | semi-joins (+ `include_aux` flag) |
| RSS | same columns | same joins, primary-only (compat) |
| Recommendations | `WHERE vid_preacher = ?` | `video_id IN (…video_profiles…)` |

At 16k videos and ≤ ~50k join rows all of this is index-lookup cheap; no
performance regression expected.

### 4.3 Classification decision order (new stage 2 behavior)

```
1. Voice service returns per-speaker findings for the video.
2. If HIGH-confidence primary voice exists:
     primary profile = voice match        (voice beats metadata, per requirement)
     auxiliary profiles = other HIGH/MEDIUM voice matches
3. Else (no voice match or LOW):
     primary profile = LLM metadata match  (today's behavior, unchanged)
     auxiliaries stay empty
4. Conflict detection: voice-HIGH profile ≠ LLM-chosen profile
     → do NOT silently override; route to human review queue
       (metadata says A, voice says B → human picks; their choice feeds re-enrollment)
5. New-voice detection: strong speaker with no gallery match (high internal
   consistency, low gallery similarity, enough speech ratio)
     → stage a NEW profile with audio evidence (preacher name from LLM/title +
       clip links for listening), exactly like today's staging workflow.
```

Everything voice-driven is **evidence-backed and reversible**: the `video_speakers`
row stores the raw scores, so any human decision (approve/reject/re-enroll) is
auditable and correctable without re-running models.

### 4.4 Human approval surfaces (extend existing ATP-manager UI)

| Queue | What the human sees | Actions |
| --- | --- | --- |
| **Enrollment review** | Profile + N source video clips (audio player with the exact clips used), cluster consistency stats | Approve enrollment / reject / swap source clips |
| **Video re-classification review** | Video with LLM suggestion vs voice suggestion + per-speaker clips, scores, margins | Confirm primary category, confirm/deny auxiliaries |
| **New-voice staging** | Unmatched speaker clip(s), LLM-guessed name, title context | Create profile (reuse existing staging form) / dismiss |
| **Conflict queue** | Voice says X, metadata says Y, with both evidence types | Pick winner; outcome logged (feeds calibration) |

This reuses the existing staging/approval UX pattern (`atp_profiles_staging.json`,
"Apply Profile") — no new product surface needed, just new queue types in the
dashboard.

### 4.5 Frontend (allthepreaching fe/be) changes for multi-category

- **Video card / detail**: show primary category as today + small auxiliary badges
  ("also: Pastor Reyes", "guest speaker" style) — data from a new
  `GET /api/videos/:id/speakers` endpoint.
- **Category filter** (`/videos?category=`): add an `&include_aux=1` option (or make
  it default): match videos where the profile is primary *or* auxiliary.
- **`/category/:slug` page**: currently **missing (404)** while video pages link to it —
  add it (part of this refactor; see §2.3 side finding).
- **Preacher pages**: optionally split "primary sermons" vs "guest appearances".
- **RSS**: unchanged (primary category only) to stay compatible with feed readers.
- **Search/FTS**: optionally add auxiliary category text to `search_document` via the
  existing trigger mechanism (or a separate column) so "Pastor Reyes" search finds
  videos where he's a guest.

---

## 5. Bootstrap / Migration (how we get from today to voice-first)

### Phase 0 — PoC (1–2 weeks)

- Stand up Voice Service container with CAM++ (+ ECAPA A/B) and pyannote (GPU if the
  ATP host has one; otherwise CPU — see §6 for cost).
- Take ~100–200 videos where the *current* classification is known-good (pick the most
  frequent preachers) + a labeled error set (videos humans have already re-classified
  via "Apply Profile" — a free ground-truth set!).
- Measure: agreement rate vs current metadata labels, EER on our own speaker pairs
  (find similar-voice pairs among the 268), calibration points for T_high/T_med/M.
- **Exit criterion:** voice primary-match agreement ≥ ~90–95% on the known-good set,
  and the error set shows voice *catches* a meaningful share of the metadata mistakes.

### Phase 1 — Gallery + backfill (2–3 weeks)

- Migrations: `categories`, `profiles`, `video_categories`, `video_profiles`,
  `video_speakers`, `speaker_enrollments` (+ pgvector); backfill the 16k corpus
  (one-time SQL) + legacy-column sync triggers (§4.2); one-time `vid_preacher`
  name dedup review queue.
- Run whole-audio embedding over the full 16k corpus (batch job; incremental via
  `index_file`-style tracking like the subtitle indexer).
- **Bootstrap enrollments by majority vote over existing data** (~290 profiles × 10
  videos ≈ 2,900 videos ≈ ~3,300 h of audio — chunked CAM++ on CPU, a few hours):
  1. *Sample*: 10 videos per profile, quality-gated (SNR/VAD floor) and spread
     across time (old + new recordings — voice/gear drift over the years).
  2. *Per-video dominant voice*: chunked embeddings + within-video clustering →
     keep only the majority chunk cluster (the dominant speaker). A raw
     whole-audio embedding would blend in guest speakers and pollute the gallery.
  3. *Majority vote*: cluster the 10 dominant vectors; if ≥ 6–7 fall into one
     cluster (≥ ~60–70% of the sample) → that cluster is the profile's candidate
     voice. Reference vector = mean of in-cluster vectors only (outliers dropped).
  4. *Guardrails*: < 10 videos available → use all, mark low-confidence (human must
     confirm). No clear majority (e.g. 4/4/2 split) → do **not** enroll
     automatically → review queue (may be a multi-speaker channel →
     `profiles.is_multi_voice`). `other`/`12other` and topic buckets (`docs`) are
     not single-speaker profiles → skip enrollment; use them only for discovering
     *new* speakers.
  5. *Human approval*: each proposal enters the Enrollment review queue as
     "8/10 agree — [clips]"; the human listens to 2–3 clips, approves/rejects/
     swaps sources. Approve sets `speaker_enrollments.status = 'active'`.
  6. *Immediate bonus*: the minority (non-majority) sample videos are prime
     candidates for metadata misclassification → route straight to the
     re-classification/conflict queue. The bootstrap pass starts cleaning the
     data before the voice system is even "live".
- With the approved gallery: re-score all videos → fill `video_speakers` →
  populate **Conflict queue** + **re-classification review** queue for medium/low/
  high conflicts.
- *Expand & clean loop (iterate to convergence)*: newly found high-confidence
  matches for a profile can be added to its enrollment pool (re-average, keep
  history); re-scored minorities may flip categories; repeat until the queues
  drain.

### Phase 2 — Pipeline cutover (1–2 weeks)

- New stage 1.5 in ATP-manager-aio: after MP3 exists, call Voice Service;
  stage 2 receives voice findings and applies the decision order (§4.3).
- New videos: voice-first automatically; LLM metadata only fills in when voice is
  low/absent; new unknown voices → staging queue with clips.
- Keep a kill-switch config (e.g. `VOICE_CLASSIFY=off|suggest|primary`) so the
  pipeline can run metadata-only while the gallery matures.

### Phase 3 — Multi-category exposure (2–3 weeks)

- BE: `video_speakers` join queries; new `/api/videos/:id/speakers`, `?include_aux=`
  filter; add the missing `/category/:slug` page route + FE page.
- FE: auxiliary badges on cards/detail, category filter incl. auxiliaries,
  "guest appearances" split on preacher pages.

### Phase 4 — Diarization pass (ongoing)

- Run speaker-count probe on the whole corpus (cheap).
- Full pyannote diarization only for flagged videos (multi-speaker suspects, weak
  matches, "Other"-bucket videos) → compute auxiliaries, fill remaining
  `video_speakers`, feed the review queues.
- New videos: probe in-pipeline; diarize only when probe flags.

### Phase 5 — Continuous operation

- Auto re-enrollment: when N new HIGH-confidence videos for a profile accumulate,
  update the reference vector (keep history; rollback-able).
- Drift/feedback monitoring: track human overrides of voice decisions; if override
  rate climbs for a profile, flag its enrollment for review (voice changed, new
  recording gear, or a different person took over the profile).
- Quarterly audit report: voice vs metadata agreement, override rates, queue ages.

---

## 6. Compute & Resource Estimates

| Workload | Model | CPU | GPU (CUDA) |
| --- | --- | --- | --- |
| Whole-audio embedding, 18,000 h corpus | CAM++ 7.2 M | ~10–20× realtime → **~15–35 h wall-clock on a modern multi-core box** (parallel across cores; resumable) | minutes per hour of audio — trivial |
| Speaker-count probe (VAD + chunked embedding variance) | CAM++ chunks | same class as above, ~2–3× cheaper per hour (shorter processing) | trivial |
| Full diarization, whole corpus (18,000 h) | pyannote 3.1 | **impractical** (≈ realtime or slower on CPU → days-weeks) | **~7–8 h** (40–53× realtime benchmarks; 25-min file ≈ 20 s on a good GPU) |
| Diarization, on-demand (suspects only) | pyannote 3.1 | feasible for <~100 videos | ideal |

Storage: embeddings are tiny (CAM++ = 512-d float ≈ 2 KB each; even 10 vectors per
video → ~300 MB for the whole corpus). Diarization outputs (RTTM/JSON) are <1 MB per
video. → No new storage subsystem needed; Postgres holds everything.

**Hardware implication:** one GPU (even a small one, e.g. T4-class / RTX 3060-class)
makes full-corpus diarization a one-afternoon job. Without a GPU, stick to the
designed fallback: whole-audio embedding on CPU + diarization on demand for suspects
only (still correct, just slower for the multi-voice minority).
Note: the whisper.cpp STT clients already support CUDA builds, so a GPU on the ATP
host is a known, supported configuration for this stack.

---

## 7. Calibration & Quality (the part that decides real-world success)

1. **On-domain threshold set.** VoxCeleb EERs don't transfer to sermon audio.
   Build a ~300–500 clip holdout: same-pairs (same preacher, different videos) and
   different-pairs (different preachers, ideally including similar-voice pairs:
   same church, similar age/gender). From the score distribution choose
   `T_high`, `T_med`, `M` to hit a target **false-accept rate ≈ 0.5–1%** at
   ~90–95% true-accept (i.e. err on "send to human" rather than auto-wrong).
2. **Similar-voice pairs.** With 268 speakers, some pairs will be confusable
   (e.g. two preachers from the same church). The **top-1/top-2 margin** requirement
   is the main defense; those pairs get permanently higher human-review rates —
   acceptable, since the queue is the safety net.
3. **Audio quality gating.** Estimate SNR / detect near-silent or heavily distorted
   clips (ffmpeg `volumedetect`/`ebur128` + VAD speech ratio). Clips below quality
   floor are excluded from enrollment and down-weighted in matching. Phone-camera
   recordings vs church PA will score differently — the on-domain calibration
   absorbs this.
4. **Profile ≠ one voice assumption.** Some "profiles" may actually be a channel that
   hosts several preachers (or a preacher + frequent guest). Design handles this by
   allowing multiple voice signatures per profile *only if* the enrollment review
   confirms it (explicit multi-voice profile flag) — otherwise it surfaces as
   conflicts, which the human resolves by splitting or merging profiles.
5. **Auditability.** Every auto-decision stores its raw scores + model version;
   every override is logged. This makes the calibration loop (§5 Phase 5) data-driven.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Real-world accuracy below benchmark | Confidence tiers + human queues; kill-switch (`VOICE_CLASSIFY=suggest`); on-domain calibration before cutover |
| Similar voices among 268 preachers | Margin requirement; similar-voice pair detection during Phase 0; human override loop |
| Long audio dilutes secondary speakers in whole-audio embedding | Speaker-count probe → diarization path for multi-voice videos; per-speaker matching uses diarized segments only |
| pyannote HF gating (free account + accepted terms) | One-time setup; models cached in the image; all MIT. (DiariZen is the accuracy upgrade path but its CC-BY-NC weights would restrict any future commercial use — deliberate choice to avoid it.) |
| 18k h backfill cost/time | Whole-audio embedding is CPU-cheap (days → hours); diarization only for suspects; resumable batch tracking (reuse the `index_file` pattern) |
| Wrong auto-assignments at scale | High-confidence threshold set to low false-accept; conflict queue catches voice-vs-metadata disagreements; `video_speakers.status` keeps everything pending until human/approval policy says otherwise |
| Profile with multiple real speakers | Explicit multi-voice profile flag at enrollment; conflict resolution UI |
| Model drift / aging voices | Re-enrollment from fresh high-confidence videos; override-rate monitoring per profile |
| Schema change risk to live site | Additive tables only; `vid_category` semantics unchanged; new joins opt-in per endpoint; FE badges are non-blocking UI |

---

## 9. Decisions Needed (open questions)

1. **GPU availability** on the ATP host: yes/no/size → determines whether full-corpus
   diarization is a batch job or permanently on-demand.
2. **Service shape:** standalone Voice Service container (recommended) vs module inside
   ATP-manager-aio. Recommendation: separate service (torch weight, independent
   scaling/updates); talks to ATP-manager over HTTP and writes to the shared Postgres.
3. **pgvector** vs plain arrays: recommend pgvector (Postgres 18 target already in use
   via the local container setup in the runbook).
4. **Embedding model final pick** after Phase 0 A/B (CAM++ vs ECAPA on our audio).
5. **Auto-assign policy:** start with "voice suggests, human approves all" (Phase 1/2
   early) and only switch HIGH-confidence to fully automatic after the first audit
   cycle — or allow auto from day one? (Recommend: auto for HIGH only, from Phase 2.)
6. **Backfill order:** most-frequent preachers first (fastest visible win) vs
   most-erroneous "Other" bucket first (highest value). Recommendation: interleaved —
   enroll top-20 preachers first (gallery), then process the "Other"/12other bucket
   with the fresh gallery.
7. **Commercial-use posture** of the site: currently appears non-commercial (ministry
   site). All recommended components are permissive (Apache-2.0/MIT), so this only
   matters if DiariZen-like NC models are ever considered.
8. **Legacy-column drop timing:** keep `vid_category` / `vid_preacher` as
   trigger-synced caches until every consumer (BE routes, mirrors/clones) runs on the
   join tables; drop them in a final, separate migration (recommend: after ≥ 1 release
   of join-based queries in production).

---

## 10. References (all verified 2026-08-28)

**License/accuracy verification performed for this plan:**

- 3D-Speaker repo: `github.com/modelscope/3D-Speaker` — Apache-2.0 (LICENSE file read);
  EER table: CAM++ 0.65%, ERes2NetV2 0.61% (VoxCeleb1 O); SV + diarization toolkit.
- ModelScope model `iic/speech_campplus_sv_zh-cn_16k-common` — API reports license
  **"Apache License 2.0"**; `funasr/campplus` HF card — `license: apache-2.0`.
- `speechbrain/spkrec-ecapa-voxceleb` — HF API reports `license: apache-2.0`; model
  card: 0.80% EER VoxCeleb1 (VoxCeleb1+2 trained), simple Python API.
- `pyannote/pyannote-audio` — MIT (LICENSE file read);
  `pyannote/speaker-diarization-3.1` model card — `license: mit` (gated = contact form;
  HF token + accepted terms required to download); DER: VoxConverse 11.3%, AMI 18.8%;
  maintainer benchmarks: 40–53× realtime on GPU.
- `BUTSpeechFIT/DiariZen` — code MIT, weights **CC-BY-NC-4.0** (MODEL_LICENSE read);
  VoxConverse 9.1% vs pyannote 11.3%.
- `wenet-e2e/wespeaker` — Apache-2.0 code; pretrained models follow dataset license
  (VoxCeleb → CC-BY-4.0, per project docs).
- `whisperX` — BSD-2-Clause (bundles pyannote + faster-whisper).
- CAM++ paper: arXiv:2303.00332 (7.2 M params; "fast and efficient" vs ECAPA-TDNN).
- Corpus scale: live API `api.allthepreaching.com` — 16,193 videos; 290 categories;
  268 preachers; avg runtime 66.7 min (n=96) → ~18,000 h.

**Repo-internal evidence (paths):**

- `ATP-manager-aio/src/app/stages/stage2.py` (`_decide_profile_and_rename`,
  `_build_sql_params`), `llm_helper.py::match_profile`, `profile_vectorstore.py`,
  `models.py` (ProfilesManager + staging), `APPLY_PROFILE_FEATURE.md`,
  `stages/stage1.py::generate_mp3`.
- `allthepreaching/be/sql/postgres/001_init.sql` (videos schema),
  `be/routes/categories.js`, `be/routes/preachers.js`, `be/routes/videos.js`,
  `be/routes/rss.js`, `fe/pages/videos.tsx`, `fe/pages/video/[id].tsx` (category link
  to missing `/category/:slug` route), `fe/pages/preacher/[slug].tsx`.
- `distributed_batch_stt/` (whisper.cpp STT, CPU/CUDA builds) — existing audio
  infrastructure precedent.
