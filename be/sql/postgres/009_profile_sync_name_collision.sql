-- 009_profile_sync_name_collision.sql
--
-- Make the "legacy videos columns -> join tables" sync trigger tolerate two
-- profile keys claiming one display name.
--
-- Migration 007 installed this body:
--
--   insert into profiles (profile_key, name, name_slug)
--   values (v_prof_key, v_prof_name, v_prof_name)
--   on conflict (profile_key) do nothing;
--
-- profiles carries TWO unique constraints -- profile_key and name_slug -- and a
-- target-named ON CONFLICT arbitrates ONLY the named constraint. The backfill in
-- 007 cannot produce a collision (it maps each name to one canonical key), but
-- the trigger derives the key per row, so the first insert that arrives with the
-- minority key tries to create a second profile carrying an already-used
-- name_slug. That violates profiles_name_slug_key, which is not the arbitration
-- target, so it RAISES instead of doing nothing -- and because this is an AFTER
-- ROW trigger, the error aborts the whole INSERT INTO videos. Plain inserts of
-- new videos are exactly what this trigger exists to support (ATP-manager
-- stage 5), so the failure lands on the ingest path.
--
-- Reproduced against a seeded copy of prod data:
--
--   ERROR: duplicate key value violates unique constraint "profiles_name_slug_key"
--   DETAIL: Key (name_slug)=(Pastor Steven Anderson) already exists.
--   CONTEXT: SQL statement "insert into profiles ..." 
--     PL/pgSQL function atp_sync_join_tables_from_videos() line 33 at SQL statement
--
-- Production currently holds no duplicate name_slug (239 profiles / 239 distinct
-- names), but 17 videos carry a vid_preacher label whose plausible profile_id
-- disagrees with the canonical key for that name: 'Matthew Stucky' with keys
-- {Eric_Loschko, Matthew_Stucky} across 14 videos, and 'Newest' with
-- {newest, Tq8BoXe6GnUk3ZmIi5GhSd0Oo} across 3. The next stage-5 insert on the
-- minority key for either name fails today.
--
-- Resolution order: the profile that already owns this display name, then the
-- profile with the exact key, then create. Name ownership must come first, not
-- just to dodge the constraint: atp_sync_videos_from_profile() writes p.name
-- back into videos.vid_preacher, so resolving by key would silently rename the
-- preacher on the video row. Preferring the name keeps the video's displayed
-- label stable and agrees with the canonical mapping 007's backfill chose.
--
-- The trigger is deliberately NOT dropped and recreated. pg_trigger.tgfoid binds
-- a trigger to the function itself, so CREATE OR REPLACE FUNCTION swaps the body
-- the existing trigger will execute. Recreating it would take ACCESS EXCLUSIVE on
-- videos -- the lock that made migration 008 fail on production the first time --
-- for no behavioral gain.
--
-- No table is altered and no row is rewritten: existing profiles, video_profiles
-- and videos rows are untouched. Safe to apply under load.

create or replace function atp_sync_join_tables_from_videos()
returns trigger
language plpgsql
as $$
declare
  v_cat_id integer;
  v_prof_id integer;
  v_cat_slug text;
  v_prof_name text;
  v_prof_key text;
begin
  -- category side: unchanged. categories has a single unique constraint (slug),
  -- so the named-target ON CONFLICT there covers every way the insert can fail.
  v_cat_slug := btrim(coalesce(new.vid_category, ''));
  if new.vid_category is distinct from old.vid_category and v_cat_slug <> '' then
    insert into categories (slug, name)
    values (v_cat_slug, coalesce(nullif(btrim(new.search_category), ''), v_cat_slug))
    on conflict (slug) do nothing;
    select id into v_cat_id from categories where slug = v_cat_slug;
    delete from video_categories
      where video_id = new.id and is_primary;
    insert into video_categories (video_id, category_id, is_primary, source)
    values (new.id, v_cat_id, true,
            case when tg_op = 'INSERT' then 'metadata' else 'manual' end);
  end if;

  -- profile side
  v_prof_name := btrim(coalesce(new.vid_preacher, ''));
  if new.vid_preacher is distinct from old.vid_preacher and v_prof_name <> ''
     and v_prof_name not in ('-', '<from the context or Unknown>') then
    v_prof_key := case
      when atp_profile_id_plausible(new.profile_id) then new.profile_id
      else atp_profile_key_from_name(v_prof_name)
    end;
    if v_prof_key is not null and btrim(v_prof_key) <> ''
       and v_prof_key <> 'Unknown' then
      -- whoever already owns the display name wins, then the exact key.
      select id into v_prof_id from profiles
        where name_slug = v_prof_name
           or name = v_prof_name
           or profile_key = v_prof_key
        order by (name_slug = v_prof_name) desc,
                 (name = v_prof_name) desc,
                 (profile_key = v_prof_key) desc,
                 id
        limit 1;
      if not found then
        -- Nothing owns this name or key. Bare ON CONFLICT (no target) so that a
        -- concurrent insert racing on EITHER unique column is a no-op here
        -- rather than an abort of the caller's video insert.
        insert into profiles (profile_key, name, name_slug)
        values (v_prof_key, v_prof_name, v_prof_name)
        on conflict do nothing;
        select id into v_prof_id from profiles
          where name_slug = v_prof_name
             or name = v_prof_name
             or profile_key = v_prof_key
          order by (name_slug = v_prof_name) desc, id
          limit 1;
      end if;
      if found then
        delete from video_profiles
          where video_id = new.id and is_primary;
        insert into video_profiles (video_id, profile_id, is_primary, source)
        values (new.id, v_prof_id, true,
                case when tg_op = 'INSERT' then 'metadata' else 'manual' end);
      end if;
    end if;
  end if;

  return new;
end;
$$;
