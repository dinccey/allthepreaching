# Voice-Classification Deploy Runbook

Status: **fully validated end-to-end on the playground (192.168.8.101), incl. full prod-scale DB** — 2026-08-28/29.

Full loop verified on the playground: bootstrap profiles 336 (Pastor Anderson, 10/10),
227 (Bruce Mejia, 9/10), 335 (Jonathan Shelley, 10/10) → pending enrollments → approve
via manager `POST /api/voice/enrollments/{id}/approve` → re-analyze known videos →
**tier HIGH (0.858–0.947)** → `video_speakers` rows `accepted` →
`GET /api/videos/:id/speakers` (BE) resolves profiles with slug/name → FE video page
shows primary + auxiliary 🎙 badges. Subtitle FTS verified on the **real 9.69M-row
`subtitle_documents`** (warm ranked query 131 ms, GIN count 47 ms; BE end-to-end
search ≈0.85 s cold, FE search page renders ranked video + caption sections).

## DB copy method (prod → playground, read-only on prod)

`pg_dump -Fd` over this NAT dies at a hard ~1.33 GB per-connection cap (twice, identical
point in `subtitle_documents`). Working method — **chunked COPY via psql + zstd**:

- `subtitle_documents`: 16 PK-range buckets (first hex char of the 64-char text PK,
  `id >= 'X' AND id < 'X+1'`). `search_document` is NOT copied — a local BEFORE-INSERT
  trigger recomputes it; `text_tsvector` is GENERATED STORED (not COPY-able), also
  recomputed locally.
- `index_item`: 8 PK-range buckets over the id range. `index_file`/`videos`: small CSV
  snapshot taken at load time (FK-consistent upsert, covers rows added mid-copy).
- Client-side compression (`psql ... | zstd -T0`), one chunk per file, `.done` markers
  → resumable. **MAXPAR=2 on the prod side** (4 exhausted prod `/dev/shm`).
- Load order: `videos` upsert → `index_file` upsert → TRUNCATE+COPY `index_item` →
  TRUNCATE+COPY `subtitle_documents` → setval sequences → ANALYZE (~90 min on a
  4-core/6 GB host for 9.7M subtitle rows).
- Scripts kept on the playground: `/home/user/dumps/chunkdump.sh`, `chunkload.sh`.

## Classification strategy (2026-08-29, LLM-primary / voice-fallback)

Decision order in stage 2 (`_decide_profile_and_rename`):

1. **LLM title classification is the primary profile source.** The LLM sees
   title + uploader + duration and picks a profile. When it places the video
   on a known profile, that profile wins and **no voice analysis runs**
   (saves 5–15 min of CPU per video).
2. **Voice classification runs ONLY when the title was not sufficient** — i.e.
   the LLM lands on `Other` (case-insensitive), a profile key that doesn't
   exist, or returns nothing. In that case voice analysis of the audio is
   mandatory ("Other must always run").
3. **Voice-based category:** if the voice service returns a **HIGH** tier
   match to a known gallery profile (`override_on_high`, default true), the
   video is categorized by voice — profile + category come from the speaker,
   not the title. A Telegram event ("Voice-based category assigned") and a
   log-manager row document the decision.
4. **No HIGH match:** the video stays `Other` (or gets a title-derived new
   profile staged for review, as before) and the `video_speakers` evidence
   rows remain in the DB for inspection / later re-classification once more
   profiles are enrolled.

`POST /api/voice/reclassify-others` (manager, background job) makes "Other
must always run" true for the **existing catalog** too: it scans videos with
`vid_preacher='Other'` that have no voice evidence yet, analyzes each via the
companion MP3 URL (limit ≤100, resumable — re-run picks up the rest), and
applies HIGH matches to the video's profile columns (legacy triggers sync the
joins). Body: `{"limit": 25, "apply": true, "video_id": 123}` (`video_id`
force-runs a single video even if evidence exists); status via
`GET /api/voice/reclassify-others/status`. Telegram summarizes reclassified
videos on completion.

Verified on the playground:

- LLM-primary path: Rumble video "My Challenge to Pastor Jeff Durbin of
  Apologia Church" (id 10015125, uploader = Anderson's Rumble channel) →
  LLM placed it on `Pastor_(Steven)_(L.)_Anderson` from title/uploader, voice
  was skipped, category = Sermons Pastor Steven Anderson (fsanderson).
- Other→voice path: video 10005616 reset to `Other` state → reclassify-others
  → service HIGH match (0.8577, profile 336) → video re-categorized to
  Anderson, evidence row `accepted`, joins trigger-synced.
- Batch scan path: candidate query correctly returns the newest evidence-less
  `Other` videos; job processes them in order, keeps true unknowns as Other.

## Verified on the playground (full scale)

## Components

| component | what | where (playground) |
| --- | --- | --- |
| Postgres 18 | `alltdjli_pas` with new voice schema (migrations 006/007) | local system PG, `127.0.0.1:5432` (also on `172.17.0.1`, `192.168.8.101`) |
| BE (Node/Express) | routes served from `categories`/`profiles`/`video_*` join tables; auto-runs `be/sql/postgres/*.sql` on startup | container `atp_be`, host-net, port 3001 |
| FE (Next.js) | new `/category/[slug]` page, video-detail voice badges, hooks | container `atp_fe`, host-net, port 3000 |
| atp-voice (FastAPI) | ECAPA-TDNN embeddings, chunk clustering, gallery matching, enrollment bootstrap | container `atp_voice`, port 5002 — source lives in `ATP-manager-aio/atp-voice/` (same repo as the manager) |
| ATP-manager | stage-2 voice hook, `/api/voice/*` UI endpoints, voice-signature backup/restore, Telegram alerts | container `atp_video`, bridge, port 5000 (reaches voice at `http://172.17.0.1:5002`) |

Schema (migration `006_voice_schema.sql`, idempotent, auto-run by `be/db-migrate.js` on BE startup):
`categories`, `profiles`, `video_categories`, `video_profiles` (M2M, `is_primary` + `source`),
`video_speakers` (evidence), `speaker_enrollments` (gallery). Legacy `videos.vid_category` /
`vid_preacher` / `search_category` / `profile_id` stay trigger-synced as a derived cache
(`007_voice_backfill_sync.sql`), so all old consumers keep working.

- **Full prod-scale data**: `videos` 16,237, `index_file` 16,237, `index_item` 9,685,811,
  `subtitle_documents` 9,685,812 (matches prod; index_item off by one due to a live
  prod insert mid-copy — expected and harmless).
- Backfill: 237 profiles, 289 categories, 16,115 primary `video_profiles`, 16,140 `video_categories`.
- Server-side query times (log_min_duration, real data): legacy category list ~2 ms;
  new join list 3–6 ms; recommendations 0.4 ms; title FTS 1.4 ms (unchanged).
  **Subtitle FTS (9.69M rows, warm)**: GIN-indexed count 47 ms; ranked top-10 with
  `ts_rank_cd` + `ts_headline` 131 ms. BE `/api/search?q=grace&mode=subtitles` end-to-end
  ≈0.85 s cold. FE search page shows ranked videos (54) + caption sections (5,992 total,
  per-video match counts, timestamped snippet links).
- `GET /api/categories`, `/api/categories/:slug`, `/api/preachers`,
  `/api/preachers/<name|profile_key>`, `/api/videos?category=…`, `/api/videos/:id/speakers` all pass.
- Annotate a video: `POST /videos/{id}/analyze` (sync, CPU: ~5–8 min per 20-min video on 4 cores)
  → writes `video_speakers` row (status `pending`, tier `low` when gallery empty).
- **3-profile gallery live**: enrollments id 1/336 Anderson, 2/227 Mejia, 3/335 Shelley —
  all `active`. Cross-profile discrimination verified (see thresholds note).
- Backup item `voice_signatures` exports/imports `speaker_enrollments` + `video_speakers`
  (replace-per-backup semantics; per-profile restore via `POST /api/voice/restore` with `profile_ids`).
- Manager → voice → PG chain verified through `/api/voice/health`.

## Prod deploy steps

Prod DB is the live Postgres at the usual host (see `database_config.json` in the manager data dir).
**Nothing in this flow writes outside the configured DB; run from the manager host.**

1. **BE (schema migration auto-runs).**
   Deploy the current `allthepreaching` BE build. On startup `db-migrate.js` applies
   `006_voice_schema.sql` + `007_voice_backfill_sync.sql` idempotently (each in its own
   transaction; backfill takes a few minutes on ~16k videos — run during a low-traffic window).
   Verify:

   ```sql
   select count(*) from profiles;          -- expect ≈237
   select count(*) from video_profiles where is_primary;
   select count(*) from video_categories;
   -- legacy columns must still equal the join truth:
   select count(*) from videos v
   where v.vid_preacher is not null and not exists (
     select 1 from video_profiles vp
     join profiles p on p.id = vp.profile_id
     where vp.video_id = v.id and vp.is_primary and p.name = v.vid_preacher);
   ```

   FE deploys with the same release (no separate step needed; pages are backward compatible).

2. **Voice service** (built from `ATP-manager-aio/atp-voice/`):

   ```bash
   cd ATP-manager-aio
   docker build -t atp-voice:latest atp-voice/
   docker run -d --name atp_voice --restart unless-stopped \
     -e DB_HOST=<prod-pg-host> -e DB_PORT=5432 \
     -e DB_USER=alltdjli -e DB_PASS=<pw> -e DB_NAME=alltdjli_pas \
     -e BASE_SITE_URL=https://kjv1611only.com \
     -e MAX_CONCURRENT_ANALYZES=1 \
     -e ENROLL_AUDIO_SECONDS=600 \
     atp-voice:latest
   curl -s http://127.0.0.1:5002/health   # expect {"status":"ok","db":true,...}
   ```

   Or, when deploying the manager via `docker compose` (see step 3), the
   `atp-voice` service is part of the stack — no separate build needed.

   CPU-only. First request loads the ECAPA model (~10–30 s). ~5–15 min of wall time per
   hour of audio; `MAX_CONCURRENT_ANALYZES=1` bounds RAM on small hosts.
   `ENROLL_AUDIO_SECONDS` caps each bootstrap sample (default 600 s; 0 = full audio):
   10 minutes of speech is more than enough for a stable dominant-voice embedding and
   keeps a 10-sample bootstrap to ~15–30 min of CPU instead of 1–2 h.

3. **ATP-manager (full stack via compose).**
   The manager repo ships a `docker-compose.yml` that runs the complete stack:
   manager (`atp_video`) + voice (`atp_voice`) + FlareSolverr + a mitm-solver
   proxy (yt-dlp traffic for bot-protected hosts is routed through it; 403/503
   blocks are solved by FlareSolverr in a real Chrome browser — this is what
   makes Rumble URLs with tracking/embed params downloadable) + RSS Bridge.

   ```bash
   cd ATP-manager-aio
   cp .env.example .env    # set DB_* / BASE_SITE_URL / ENROLL_AUDIO_SECONDS
   docker compose up -d --build
   ```

   - The compose `atp` service sets `YTDLP_PROXY=http://mitm-solver:8192`
     (that's what routes yt-dlp through the solver proxy); `BLOCKED_HOSTS` on
     the mitm-solver service (default `rumble.com`) picks which 403/503
     responses get solved in the browser. Media/binary responses are never
     routed through the browser.
   - Optional `--profile pg` starts a built-in Postgres instead of using the
     existing one.
   - Manager data dir `atp_config.json`:

     ```json
     "voice": {
       "enabled": true,
       "service_url": "http://172.17.0.1:5002",
       "analyze_timeout_seconds": 5400,
       "override_on_high": true,
       "notify_on_conflict": true,
       "bootstrap_timeout_seconds": 10800
     }
     ```

     (with `docker compose` deployment use `http://atp-voice:5002` — compose
     service DNS; bare-container setups use the host-gateway IP, the host's
     LAN IP, or `host.docker.internal`.)
   - Telegram: fill `notifications.telegram_bot_token` / `telegram_chat_id` (manager UI or
     `atp_config.json`). Voice alerts (enrollment proposed/awaiting, voice/LLM conflict,
     bootstrap failure, restore) are gated by `notifications.notify_error`.

4. **Bootstrap galleries (per profile, majority-vote).**
   For each major profile (start with the biggest):

   ```bash
   curl -X POST http://127.0.0.1:5002/profiles/{profile_id}/enroll \
     -H 'Content-Type: application/json' -d '{"sample_size": 10, "auto_approve": false}'
   ```

   (or `POST /api/voice/profiles/{id}/enroll` through the manager). With the default
   600 s sample cap this takes ~15–30 min per profile on 4 CPU cores (downloads 10
   sample MP3s, analyzes each truncated to 10 min); uncapped it is ~40–90 min.
   Quorum: ≥60 % of analyzable
   samples must agree on one voice, min 6 samples → a **pending** enrollment is created and
   Telegram notifies. Approve: `POST /api/voice/enrollments/{id}/approve` (or
   `/enrollments/{id}/reject` with a reason). After approval the profile is in the gallery
   and subsequent analyses can tier HIGH against it.

   Verified playground result (profile 336, 10 samples): all 10 analyzed clean
   (`dominant_ratio` 1.0, single speaker), agreement 10/10 → enrollment proposed
   in ~25 min with the 600 s cap. Note: the bootstrap response is a long-poll — run it
   with a long client timeout or in the background (`curl -m 7200`); the enrollment is
   committed to `speaker_enrollments` only at the end.

5. **Full-stack compose deploy — verified 2026-08-29 (playground).**
   `docker compose up -d --build atp atp-voice flaresolverr mitm-solver`
   (skip `rss-bridge` if port 3000 is taken; point `RSS_BRIDGE_HOST` at the
   standalone bridge instead). Notes learned the hard way:

   - **Compose project namespaces volumes** (`<project>_atp_data`, ...). Seed
     config files (`atp_config.json`, `stage1_prompts.json`, `atp_profiles.json`,
     `database_config.json`, ...) into the *namespaced* volume — the manager
     needs `stage1_prompts.json` at startup for LLM classification.
   - **Stage-2 local-audio path sharing**: the voice service must see the
     manager's data volume (compose mounts `atp_data:/data:ro` into
     `atp-voice`); otherwise `/data/downloads/*.mp3` handed to
     `/videos/{id}/analyze` 404s inside the voice container.
   - **Host Postgres + compose subnets**: a host-local PG must accept the
     compose bridge subnet (playground: added `host all all 172.18.0.0/16
     scram-sha-256` to pg_hba + reloaded).
   - **Prompts reload**: stage 2 now reloads `stage1_prompts.json` per run, so
     UI prompt edits apply without restarting the manager (previously cached
     at container start).
   - **Voice evidence on pre-insert row ids**: `analyze_wav` skips the
     `video_speakers` upsert when the `videos` row does not exist yet (FK).
     The pipeline closes the loop in stage 3: stage 2 carries the speaker
     list in the manifest (`sql_params.voice_speakers`), and stage 3 emits
     `video_speakers` INSERTs right after each video INSERT in the daily SQL
     file (same safe id; stage 5 executes them in order). Guarded with
     `WHERE NOT EXISTS (video_id + speaker_label)` so re-runs of the SQL
     file never duplicate evidence. Status: high → `accepted` (with matched
     profile), else `pending`. Verified 2026-08-29 with a 2-speaker synthetic
     run (emission + stage-5 execution + idempotent re-run + cascade cleanup
     all pass; test script `test_voice_evidence_emit.py` in ATP-manager-aio,
     playground-only).

   Verified with the user's exact Rumble URL (tracking `e9s=` params):
   FlareSolverr solves it directly (HTTP 200 + 6 cookies), and the manager
   downloaded it through `YTDLP_PROXY=http://mitm-solver:8192` (29.68 MB,
   37 s; media chunks pass the proxy untouched, only blocked page requests
   would be solved in the browser). LLM then classified it
   `Pastor_(Steven)_(L.)_Anderson` / `fsanderson` with voice skipped
   (title was sufficient) — the intended primary path.

   FE category chips also verified on the playground (Videos page →
   Filters → Categories): chips render `{name} ({videoCount})` with the
   live join-based counts (e.g. "Steven L. Anderson (4499)", 289
   categories total) and clicking a chip filters the grid correctly
   (all first-page results from that category).

6. **Verify.**
   - `/api/voice/health` → `healthy: true`, `gallery_size` grows after approvals.
   - Re-analyze one known profile's video → expect tier `high`/`medium` with
     `top1_profile` set (playground: 0.858 HIGH on a 20-min Anderson video against the
     10-sample gallery).
   - `GET /api/videos/:id/speakers` (BE) returns evidence rows with profile slug/name;
     the FE video page shows auxiliary voice badges only when extra speakers exist.

## Ops notes

- **BE API key casing (Postgres gotcha)**: Postgres lowercases *unquoted* result aliases,
  whereas the legacy MariaDB-era FE expects camelCase (`videoCount`, `videoCountAux`,
  `latestVideo`, `firstVideo`, `totalViews`). The new `preachers.js` / `categories.js`
  routes quote these aliases (`AS "videoCount"`) to preserve the FE contract. If you add
  multi-word aliases in these routes, quote them; single-word keys (e.g. `name`, `slug`)
  are fine unquoted.
- **Thresholds** (calibrated on playground, 3-profile gallery): `T_HIGH=0.55`, `T_MED=0.40`,
  `MARGIN=0.08`, `CLUSTER_JOIN_COSINE=0.55` (env-overridable on the voice container).
  Observed ECAPA cosine: same-speaker cross-session **0.86–0.96**, different speakers
  **0.22–0.43** → HIGH tier sits in a wide gap, ~3× headroom. Verified per profile:
  - Anderson video → top1 Anderson 0.858 (top2 0.219, margin 0.639, HIGH).
  - Mejia video → top1 Mejia 0.947 (top2 0.294, margin 0.654, HIGH).
  - Shelley in-sample video → S2 Shelley 0.964 HIGH; **same video also has a second
    speaker S1 → Anderson 0.434 MEDIUM** (multi-speaker; FE shows an auxiliary
    🎙 badge for the non-primary speaker). Out-of-sample multi-speaker videos whose
    dominant voice isn't the enrolled one correctly stay LOW (no false HIGH).
  All evidence rows land `accepted` with the right profile. Re-tune only if a new
  speaker pair measures inside the 0.43–0.55 gap.
- **Re-run analyze after gallery changes**: evidence rows are upserted per
  `(video_id, speaker_label)` — re-POST `/videos/{id}/analyze` to re-score against a
  populated gallery.
- **Backup**: full manager backup now includes `voice_signatures`; dedicated download:
  `GET /api/voice/backup`; restore: `POST /api/voice/restore` (multipart `file` + optional
  `profile_ids`). Restore replaces enrollments for the backed-up profiles and evidence for
  the backed-up videos.
- **Rollback**: legacy columns stay trigger-synced, so reverting the BE to the pre-voice
  build leaves the site fully functional (joins simply go unused). To fully remove the
  schema later: drop the six tables in a follow-up migration (after all consumers migrated
  and a final audit).
- **Known environment quirks (playground only)**: 6 GB RAM host; keep
  `MAX_CONCURRENT_ANALYZES=1`; NAT limits chunk COPY to ~4 Mbps and caps a single
  `pg_dump` transfer at ~1.33 GB (use the chunked COPY method above).
