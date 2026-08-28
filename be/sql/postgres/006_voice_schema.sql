-- 006_voice_schema.sql
-- Normalized classification schema + voice-signature tables.
--
--   categories          : site-facing groups (preacher pages AND topic categories like 'docs')
--   profiles            : preacher / speaker identity (voice enrollments attach here)
--   video_categories    : M2M video<->category  (is_primary + source)
--   video_profiles      : M2M video<->profile   (is_primary + source)  = classification truth
--   video_speakers      : raw voice evidence per detected speaker (incl. unmatched)
--   speaker_enrollments : enrolled voice signatures per profile (the gallery)
--
-- Legacy columns on videos (vid_category, search_category, vid_preacher, profile_id)
-- are kept as a derived cache, maintained by triggers in 007_voice_backfill_sync.sql,
-- so existing consumers (mirrors/clones, FTS trigger, ATP-manager stage-5 SQL) keep
-- working until they are migrated.
--
-- No pgvector dependency: the gallery is tiny (~hundreds of 512-d vectors), so
-- cosine matching runs in app code over float8[]. Keeps the migration portable to
-- any stock PostgreSQL.

create table if not exists categories (
  id integer generated always as identity primary key,
  slug text not null unique,                 -- 'fsmejia', 'docs', 'other'
  name text not null,                        -- 'Sermons Pastor Mejia' (was videos.search_category)
  sort_order integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id integer generated always as identity primary key,
  profile_key text not null unique,          -- ATP-manager key, e.g. 'Bruce_Mejia'
  name text not null,                        -- canonical display name (was videos.vid_preacher)
  name_slug text not null unique,            -- used by /preacher/:slug (same as name for now)
  category_id integer references categories(id),  -- home category
  main_category text,                        -- legacy free text (was videos.main_category)
  is_multi_voice boolean not null default false, -- channel hosting several speakers
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists video_categories (
  video_id integer not null references videos(id) on delete cascade,
  category_id integer not null references categories(id) on delete restrict,
  is_primary boolean not null default false,
  source text not null default 'metadata'
         check (source in ('metadata','voice','manual','import')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (video_id, category_id)
);
create unique index if not exists idx_one_primary_category
  on video_categories (video_id) where is_primary;
create index if not exists video_categories_category_idx
  on video_categories (category_id, video_id);

create table if not exists video_profiles (
  video_id integer not null references videos(id) on delete cascade,
  profile_id integer not null references profiles(id) on delete restrict,
  is_primary boolean not null default false,
  source text not null default 'metadata'
         check (source in ('metadata','voice','manual','import')),
  confidence text check (confidence in ('high','medium','low')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (video_id, profile_id)
);
create unique index if not exists idx_one_primary_profile
  on video_profiles (video_id) where is_primary;
create index if not exists video_profiles_profile_idx
  on video_profiles (profile_id, video_id);

-- raw voice evidence: one row per detected speaker, incl. unmatched voices
create table if not exists video_speakers (
  id bigint generated always as identity primary key,
  video_id integer not null references videos(id) on delete cascade,
  speaker_label text not null,               -- 'S1','S2',... or 'whole'
  pipeline text not null default 'whole_audio'
         check (pipeline in ('whole_audio','diarized','bootstrap')),
  speech_ratio double precision,             -- fraction of runtime this speaker holds
  matched_profile_id integer references profiles(id),  -- null = unmatched
  score_top1 double precision,
  score_top2 double precision,
  margin double precision,
  confidence text check (confidence in ('high','medium','low')),
  model_version text,
  status text not null default 'pending'
         check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists video_speakers_video_idx on video_speakers (video_id);
create index if not exists video_speakers_matched_idx on video_speakers (matched_profile_id);

-- enrolled voice signatures (the gallery)
create table if not exists speaker_enrollments (
  id bigint generated always as identity primary key,
  profile_id integer not null references profiles(id) on delete cascade,
  source_video_id integer references videos(id),
  clip_path text,
  embedding float8[] not null,               -- 192-d (model-dependent) L2-normalized speaker vector
  model_version text,
  notes text,
  approved_by text,
  approved_at timestamptz,
  status text not null default 'pending'
         check (status in ('pending','active','retired','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists speaker_enrollments_profile_idx
  on speaker_enrollments (profile_id, status);

-- updated_at maintenance (reuses the atp_set_updated_at trigger function from 001)
drop trigger if exists categories_set_updated_at on categories;
create trigger categories_set_updated_at
before update on categories
for each row execute function atp_set_updated_at();

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
before update on profiles
for each row execute function atp_set_updated_at();
