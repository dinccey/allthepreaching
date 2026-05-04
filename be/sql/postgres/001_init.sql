create extension if not exists pg_trgm;

create or replace function atp_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function atp_build_videos_search_document(
  in_vid_title text,
  in_name text,
  in_vid_preacher text,
  in_vid_category text,
  in_search_category text
)
returns tsvector
language sql
immutable
as $$
  select
    setweight(to_tsvector('simple', coalesce(in_vid_title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(in_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(in_vid_preacher, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(in_vid_category, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(in_search_category, '')), 'C');
$$;

create or replace function atp_set_videos_search_document()
returns trigger
language plpgsql
as $$
begin
  new.search_document := atp_build_videos_search_document(
    new.vid_title,
    new.name,
    new.vid_preacher,
    new.vid_category,
    new.search_category
  );
  return new;
end;
$$;

create table if not exists videos (
  id integer primary key,
  vid_category text,
  search_category text,
  vid_preacher text,
  name text,
  vid_title text,
  vid_code text,
  date text,
  published_at date,
  vid_url text,
  thumb_url text,
  pic_url text,
  header_url text,
  video_id text,
  profile_id text,
  main_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  clicks integer not null default 0,
  shorts boolean not null default false,
  language varchar(10) not null default 'en',
  runtime_minutes numeric(8,2),
  search_document tsvector
);

create table if not exists docs_upload (
  id integer primary key,
  name text,
  link text,
  code text
);

create or replace function atp_build_subtitle_search_document(
  in_text text,
  in_title text,
  in_author text,
  in_category_info text
)
returns tsvector
language sql
immutable
as $$
  select
    setweight(to_tsvector('simple', coalesce(in_text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(in_title, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(in_author, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(in_category_info, '')), 'C');
$$;

create or replace function atp_set_subtitle_search_document()
returns trigger
language plpgsql
as $$
begin
  new.search_document := atp_build_subtitle_search_document(
    new.text,
    new.title,
    new.author,
    new.category_info
  );
  return new;
end;
$$;

create table if not exists subtitle_documents (
  id text primary key,
  video_pk integer not null references videos(id) on delete cascade,
  subtitle_path text not null,
  cue_index integer not null,
  timestamp_seconds double precision not null,
  text text not null,
  title text,
  author text,
  category_name text,
  category_slug text,
  video_url text,
  thumbnail_url text,
  language text,
  runtime_minutes numeric(10,2),
  category_info text,
  video_date timestamptz,
  search_document tsvector
);

alter table subtitle_documents
  add column if not exists category_name text;
alter table subtitle_documents
  add column if not exists category_slug text;
alter table subtitle_documents
  add column if not exists video_url text;
alter table subtitle_documents
  add column if not exists thumbnail_url text;
alter table subtitle_documents
  add column if not exists language text;
alter table subtitle_documents
  add column if not exists runtime_minutes numeric(10,2);

create table if not exists index_file (
  id bigserial primary key,
  video_pk integer not null unique references videos(id) on delete cascade,
  file_path text not null unique,
  subtitle_path text not null,
  processed boolean not null default false,
  file_deleted boolean not null default false,
  processing_error text,
  file_changed boolean not null default false,
  file_hash varchar(64),
  file_mtime timestamptz,
  file_size bigint,
  indexed_at timestamptz,
  source_updated_at timestamptz,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table index_file
  add column if not exists file_mtime timestamptz;
alter table index_file
  add column if not exists file_size bigint;
alter table index_file
  add column if not exists source_updated_at timestamptz;
alter table index_file
  add column if not exists last_seen_at timestamptz;

create table if not exists index_item (
  id bigserial primary key,
  index_file_id bigint not null references index_file(id) on delete cascade,
  document_id text not null unique
);

create table if not exists indexer_state (
  name text primary key,
  status text,
  last_started_at timestamptz,
  last_successful_at timestamptz,
  last_failed_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists videos_vid_preacher_idx on videos (vid_preacher);
create index if not exists videos_vid_category_idx on videos (vid_category);
create index if not exists videos_search_category_idx on videos (search_category);
create index if not exists videos_language_idx on videos (language);
create index if not exists videos_date_desc_idx on videos (date desc);
create index if not exists videos_published_at_desc_idx on videos (published_at desc nulls last);
create index if not exists videos_created_at_desc_idx on videos (created_at desc);
create index if not exists videos_clicks_desc_idx on videos (clicks desc);
create index if not exists videos_video_id_idx on videos (video_id);
create index if not exists videos_vid_url_idx on videos (vid_url);
create index if not exists videos_preacher_published_at_idx on videos (vid_preacher, published_at desc nulls last);
create index if not exists videos_category_published_at_idx on videos (vid_category, published_at desc nulls last);
create index if not exists videos_search_document_gin_idx on videos using gin (search_document);
create index if not exists subtitle_documents_video_pk_idx on subtitle_documents (video_pk);
create index if not exists subtitle_documents_subtitle_path_idx on subtitle_documents (subtitle_path);
create index if not exists subtitle_documents_timestamp_idx on subtitle_documents (timestamp_seconds);
create index if not exists subtitle_documents_search_document_gin_idx on subtitle_documents using gin (search_document);
-- Dedicated index for caption-text-only full-text search (used by the text search input).
-- Required because the main search_document also indexes title/author/category_info.
create index if not exists subtitle_documents_text_tsvector_gin_idx on subtitle_documents using gin (to_tsvector('simple', coalesce(text, '')));
create index if not exists subtitle_documents_category_name_trgm_idx on subtitle_documents using gin (category_name gin_trgm_ops);
create index if not exists subtitle_documents_category_info_trgm_idx on subtitle_documents using gin (category_info gin_trgm_ops);
create index if not exists subtitle_documents_title_trgm_idx on subtitle_documents using gin (title gin_trgm_ops);
create index if not exists subtitle_documents_author_trgm_idx on subtitle_documents using gin (author gin_trgm_ops);
create index if not exists index_file_processed_idx on index_file (processed, file_deleted);
create index if not exists index_file_file_deleted_idx on index_file (file_deleted);
create index if not exists index_file_source_updated_at_idx on index_file (source_updated_at);
create index if not exists index_file_file_mtime_idx on index_file (file_mtime);
create index if not exists index_item_index_file_id_idx on index_item (index_file_id);

drop trigger if exists videos_set_updated_at on videos;
create trigger videos_set_updated_at
before update on videos
for each row
execute function atp_set_updated_at();

drop trigger if exists videos_set_search_document on videos;
create trigger videos_set_search_document
before insert or update of vid_title, name, vid_preacher, vid_category, search_category
on videos
for each row
execute function atp_set_videos_search_document();

drop trigger if exists index_file_set_updated_at on index_file;
create trigger index_file_set_updated_at
before update on index_file
for each row
execute function atp_set_updated_at();

drop trigger if exists indexer_state_set_updated_at on indexer_state;
create trigger indexer_state_set_updated_at
before update on indexer_state
for each row
execute function atp_set_updated_at();

drop trigger if exists subtitle_documents_set_search_document on subtitle_documents;
create trigger subtitle_documents_set_search_document
before insert or update of text, title, author, category_info
on subtitle_documents
for each row
execute function atp_set_subtitle_search_document();

update videos
set search_document = atp_build_videos_search_document(
  vid_title,
  name,
  vid_preacher,
  vid_category,
  search_category
)
where search_document is null;

update subtitle_documents
set search_document = atp_build_subtitle_search_document(
  text,
  title,
  author,
  category_info
)
where search_document is null;