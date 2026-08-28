# Voice-Classification Deploy Runbook

Status: **validated end-to-end on the playground (192.168.8.101)** — 2026-08-28/29.

Full loop verified on the playground: bootstrap profile 336 (Pastor Anderson) → 10/10
sample agreement (ratio 1.0) → pending enrollment → approve via manager
`POST /api/voice/enrollments/{id}/approve` → re-analyze video 10005616 → **tier HIGH
(score 0.858, margin 0.858)** → `video_speakers` row `accepted` →
`GET /api/videos/10005616/speakers` (BE) resolves the profile with slug/name.
FE video page shows the speaker badge from this data.

## Components

| component | what | where (playground) |
| --- | --- | --- |
| Postgres 18 | `alltdjli_pas` with new voice schema (migrations 006/007) | local system PG, `127.0.0.1:5432` (also on `172.17.0.1`, `192.168.8.101`) |
| BE (Node/Express) | routes served from `categories`/`profiles`/`video_*` join tables; auto-runs `be/sql/postgres/*.sql` on startup | container `atp_be`, host-net, port 3001 |
| FE (Next.js) | new `/category/[slug]` page, video-detail voice badges, hooks | container `atp_fe`, host-net, port 3000 |
| atp-voice (FastAPI) | ECAPA-TDNN embeddings, chunk clustering, gallery matching, enrollment bootstrap | container `atp_voice`, host-net, port 5002 |
| ATP-manager | stage-2 voice hook, `/api/voice/*` UI endpoints, voice-signature backup/restore, Telegram alerts | container `atp_video`, bridge, port 5000 (reaches voice at `http://172.17.0.1:5002`) |

Schema (migration `006_voice_schema.sql`, idempotent, auto-run by `be/db-migrate.js` on BE startup):
`categories`, `profiles`, `video_categories`, `video_profiles` (M2M, `is_primary` + `source`),
`video_speakers` (evidence), `speaker_enrollments` (gallery). Legacy `videos.vid_category` /
`vid_preacher` / `search_category` / `profile_id` stay trigger-synced as a derived cache
(`007_voice_backfill_sync.sql`), so all old consumers keep working.

## Verified on the playground

- Backfill: 237 profiles, 289 categories, 16,115 primary `video_profiles`, 16,140 `video_categories`.
- Server-side query times (log_min_duration): legacy category list ~2 ms; new join list 3–6 ms;
  recommendations 0.4 ms; title FTS 1.4 ms (unchanged). Subtitle FTS runs on `subtitle_documents`
  (data copied via full pg_dump; schema/triggers intact).
- `GET /api/categories`, `/api/categories/:slug`, `/api/preachers`,
  `/api/preachers/<name|profile_key>`, `/api/videos?category=…`, `/api/videos/:id/speakers` all pass.
- Annotate a video: `POST /videos/{id}/analyze` (sync, CPU: ~5–8 min per 20-min video on 4 cores)
  → writes `video_speakers` row (status `pending`, tier `low` when gallery empty).
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

2. **Voice service.**

   ```bash
   docker build -t atp-voice:1.0 atp-voice/
   docker run -d --name atp_voice --network host --restart unless-stopped \
     -e DB_HOST=<prod-pg-host> -e DB_PORT=5432 \
     -e DB_USER=alltdjli -e DB_PASS=<pw> -e DB_NAME=alltdjli_pas \
     -e BASE_SITE_URL=https://kjv1611only.com \
     -e MAX_CONCURRENT_ANALYZES=1 \
     -e ENROLL_AUDIO_SECONDS=600 \
     atp-voice:1.0
   curl -s http://127.0.0.1:5002/health   # expect {"status":"ok","db":true,...}
   ```

   CPU-only. First request loads the ECAPA model (~10–30 s). ~5–15 min of wall time per
   hour of audio; `MAX_CONCURRENT_ANALYZES=1` bounds RAM on small hosts.
   `ENROLL_AUDIO_SECONDS` caps each bootstrap sample (default 600 s; 0 = full audio):
   10 minutes of speech is more than enough for a stable dominant-voice embedding and
   keeps a 10-sample bootstrap to ~15–30 min of CPU instead of 1–2 h.

3. **ATP-manager.**
   - Push current `ATP-manager-aio` main, `git pull`, `docker build -t atp-video:latest .`,
     recreate the `atp_video` container (existing `~/redeploy-ATP-manager.sh`).
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

     (`service_url` = host-gateway IP when atp_video runs on the default bridge; use the
     host's LAN IP or `host.docker.internal` on other setups. Point at `127.0.0.1:5002`
     only if the manager itself runs on the voice host's host-net.)
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

5. **Verify.**
   - `/api/voice/health` → `healthy: true`, `gallery_size` grows after approvals.
   - Re-analyze one known profile's video → expect tier `high`/`medium` with
     `top1_profile` set (playground: 0.858 HIGH on a 20-min Anderson video against the
     10-sample gallery).
   - `GET /api/videos/:id/speakers` (BE) returns evidence rows with profile slug/name;
     the FE video page shows auxiliary voice badges only when extra speakers exist.

## Ops notes

- **Thresholds** (calibrate in Phase 0): `T_HIGH=0.55`, `T_MED=0.40`, `MARGIN=0.08`,
  `CLUSTER_JOIN_COSINE=0.55` (env-overridable on the voice container). ECAPA cosine:
  same-speaker cross-session ~0.3–0.6, different speakers ~-0.2–0.3.
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
- **Known environment quirks (playground only)**: 1.9 GB RAM → keep
  `MAX_CONCURRENT_ANALYZES=1`, PG `work_mem` low; NAT download bandwidth limits bootstrap
  sample fetches (~1–2 Mbps).
