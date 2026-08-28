# atp-voice

Voice classification service for ALLthePREACHING.

- Extracts speaker embeddings (ECAPA-TDNN by default, CAM++ optional) from a
  video's audio in sliding windows, clusters chunks into speakers, and matches
  each speaker against the enrolled-voice gallery stored in Postgres
  (`speaker_enrollments` / `video_speakers` tables — schema 006/007 of the
  allthepreaching repo).
- REST API (FastAPI): health, gallery, enrollments (list/approve/reject),
  per-video analysis, and the majority-vote enrollment bootstrap
  (`POST /profiles/{id}/enroll`).
- CPU-only. One hour of audio takes roughly 5–15 minutes on 4 cores.

## Run

```bash
docker build -t atp-voice .
docker run -d --name atp_voice --network host \
  -e DB_HOST=127.0.0.1 -e DB_PORT=5432 -e DB_USER=alltdjli \
  -e DB_PASS=<pw> -e DB_NAME=alltdjli_pas \
  atp-voice
curl http://127.0.0.1:5002/health
```

## Configuration (env)

| var | default | meaning |
| --- | --- | --- |
| DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME | 127.0.0.1:5432 | Postgres connection |
| EMBEDDING_BACKEND | ecapa | `ecapa` (SpeechBrain, VoxCeleb, Apache-2.0) or `campplus` (3D-Speaker/FunASR) |
| T_HIGH / T_MED / MARGIN | 0.55 / 0.40 / 0.08 | match thresholds (calibrate in Phase 0) |
| CLUSTER_JOIN_COSINE | 0.55 | chunk→cluster join threshold |
| CHUNK_SECONDS / HOP_SECONDS | 30 / 20 | embedding window / hop |
| MAX_CONCURRENT_ANALYZES | 2 | concurrency cap (RAM bound) |
| MODEL_VERSION_TAG | ecapa-voxceleb-v1 | provenance stamp on evidence rows |
