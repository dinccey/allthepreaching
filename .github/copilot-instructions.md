# ALLthePREACHING — Copilot Instructions

## Purpose ✅
Provide immediate, actionable context for AI coding agents so they can be productive quickly: architecture, workflows, conventions, key files, and examples of how to implement/extend features.

---

## Big picture 🔧
- Monorepo with separated FE and BE projects (built / deployed as independent images).
- FE: Next.js + React (SSR for SEO). Tailwind CSS for styling, `next build` -> static CSS.
- BE: Node.js/Express (thin API layer that is the only trustee of DB access). All DB access goes through BE (MariaDB on a private IP; FE must not connect directly).
- Videos served by a Caddy static server now; BE uses a pluggable `VideoProvider` to abstract sources (Caddy, MinIO/S3).

## Key routes & APIs (examples) 🔗
- `GET /api/videos?preacher=:slug` — list videos (filtered, paged)
- `GET /api/videos/:id` — video metadata including `vid_url` (via provider)
- `GET /api/rss?...` — server-generated RSS per category/preacher
- `GET /api/search?q=...` — proxied to the search service (separate repo)
- Mirror / clone endpoints: `/api/clone/db` and `/api/clone/files` (secure with API keys)

## Important files & conventions 📁
- Backend: `be/` — put `db.js` (mysql2 pool), `providers/VideoProvider.js`, `routes/` (`videos.js`, `rss.js`, `search.js`) and `migrate.js` for one-off data migrations.
- Frontend: `fe/` — `components/VideoPlayer` (wrap `video.js`), `pages/preacher/[slug].tsx`, `hooks/useApi.ts` (useSWR recommended).
- Env vars: **BE** — `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `VIDEO_SOURCE`; **FE** — `NEXT_PUBLIC_API_URL`.
- Dockerfiles: `be/Dockerfile`, `fe/Dockerfile` (see standard multi-stage Next build pattern).

## Project-specific patterns & decisions ⚙️
- Preacher consolidation: `vid_category` should contain a unified preacher enum/foreign key; use migrations to consolidate legacy categories.
- Video abstraction: implement `class VideoProvider { getUrl(path) { ... } }` with implementations for Caddy and S3.
- Player: use `video.js` from the start; support WebVTT captions, playback speed, PiP, and Screen Wake Lock API.
- Audio mode: BE should support on-demand audio extraction (FFmpeg) and provide audio streams/URLs.

## Local dev / build / debugging 🐞
- Dependencies are **npm workspaces** (root `package-lock.json`); there is no yarn.lock. Run scripts from the repo root with `npm run <script> --workspace be|fe`, or `cd be && npm run dev`.
- BE local: set env vars and run `npm run dev --workspace be` (or `node server.js` for prod). Default port: `3001`.
- FE local: set `NEXT_PUBLIC_API_URL=http://localhost:3001` and run `npm run dev --workspace fe` (Next default port: `3000`).
- Node: the images and CI use Node 26 (active LTS); `engines` require >=24.
- Docker quick test (build context is the **repo root**, so the Dockerfiles can reach `package-lock.json`):
  - `docker build -t atp-be:latest -f be/Dockerfile .`
  - `docker build -t atp-fe:latest -f fe/Dockerfile .`
  - `docker run -p 3001:3001 -e DB_HOST=... atp-be:latest`
  - `docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://localhost:3001 atp-fe:latest`
- Debugging tips: add `console.debug` in BE routes, enable `react-devtools` for FE, use `supertest` + `jest` for BE endpoints.

## Tests & CI 🧪
- **There are currently no test files in this repo** (`be/` and `fe/` contain zero `*.test.*`). `npm test` passes only because the scripts carry `--passWithNoTests`; treat that as debt, not coverage.
- Jest is wired up, so `be/__tests__` or `be/test` and `fe/__tests__` are the intended homes for new tests.
- Linting: Next.js 16 removed `next lint`, so FE lints via the ESLint CLI (`npm run lint --workspace fe`, config in `fe/eslint.config.mjs`). The tree currently reports ~140 pre-existing problems, so CI runs it non-blocking.
- CI: `.github/workflows/ci.yml` runs `npm ci`, typecheck, lint, test and `next build`, then builds both images from the root context.

## Search & separate services 🔎
- Search is maintained in a separate repo; prefer Elasticsearch/Algolia for scale. FE should call search via BE proxy (`/api/search`) for auth/sanity.

## Migration & data tasks 🛠️
- Migration script responsibilities: scan Caddy files, extract metadata (title, preacher, date), and insert/update `videos` table.
- `migrate.js` should run as a one-off (not in normal startup). Document the migration steps in `be/migrations/README.md`.

## Security & operations 🔐
- BE is the only component with DB credentials; do not commit secrets—use env vars / secret manager.
- Mirror/clone endpoints must be protected with API keys and rate limits.
- Use Helmet, CORS (restricted to FE origin), and input validation on API routes.

## Small, actionable guidelines for PR reviewers ✅
- Prefer small focused PRs (one feature or migration per PR).
- For data migrations: include a dry-run output and a revert/rollback plan.
- Add tests for new API endpoints and components; include an example response fixture.

---

If anything above is unclear or you want extra examples (sample `db.js`, `VideoProvider` stub, or CI workflow), tell me which section to expand and I'll update this file. 🙏
