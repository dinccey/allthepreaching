-- 007_voice_backfill_sync.sql
-- Backfills categories/profiles + primary join rows from the legacy
-- videos columns, and installs the two-way sync triggers that keep the
-- legacy columns as a derived cache of the join tables.
--
-- Key derivation mirrors ATP-manager src/app/models.py::get_profile_key():
--   strip one leading title ("Pastor "/"Bro "/"Deacon "/"Hno. "),
--   replace spaces with underscores.
-- Production profile_id values (the manager's stored keys) take priority
-- over the name-derived key whenever they are plausible.
--
-- Idempotent: inserts use ON CONFLICT DO NOTHING; safe to re-run.

-- ---------------------------------------------------------------------------
-- helper: derive an ATP-style profile key from a preacher name
-- (must stay in lockstep with get_profile_key() above)
-- ---------------------------------------------------------------------------
create or replace function atp_profile_key_from_name(p_name text)
returns text
language sql immutable
as $$
  select case
    when p_name is null
      or btrim(p_name) in ('', '-', '<from the context or Unknown>')
      then 'Unknown'
    else replace(
      (case
         when btrim(p_name) like 'Pastor %' then substring(btrim(p_name) from 8)
         when btrim(p_name) like 'Bro %'    then substring(btrim(p_name) from 5)
         when btrim(p_name) like 'Deacon %' then substring(btrim(p_name) from 8)
         when btrim(p_name) like 'Hno. %'   then substring(btrim(p_name) from 6)
         else btrim(p_name)
       end),
      ' ', '_')
  end;
$$;

-- helper: is this stored profile_id value plausible (vs import garbage such as
-- stray YouTube video ids, '<null>' import markers, Unknown_<ts> timestamps,
-- 'LLC ...' CSV noise, or CR-padded junk)?
create or replace function atp_profile_id_plausible(p_val text)
returns boolean
language sql immutable
as $$
  select p_val is not null
     and btrim(p_val) <> ''
     and lower(btrim(p_val)) not in ('null', 'none', 'n/a')  -- importer junk literals
     and p_val !~ '^[A-Za-z0-9_-]{11}$'          -- bare YouTube/Rumble video id
     and p_val !~ '^Unknown_[0-9]+$'             -- manager's unknown-key timestamp
     and position('<' in p_val) = 0              -- '<null>' import marker
     and position('>' in p_val) = 0
     and position(chr(13) in p_val) = 0          -- CR / \r noise
     and position(chr(9)  in p_val) = 0          -- tab noise
     and lower(p_val) not like '%llc%'
     and btrim(p_val) <> '-';
$$;

-- ---------------------------------------------------------------------------
-- 0) name -> profile_key map (shared by all sections below)
--    one row per distinct trimmed vid_preacher; stored plausible key wins
--    over the derived key.
-- ---------------------------------------------------------------------------
drop table if exists atp_name_key_map;
create temporary table atp_name_key_map (
  name text primary key,
  video_count bigint,
  profile_key text
);

insert into atp_name_key_map (name, video_count, profile_key)
with named as (
  select btrim(v.vid_preacher) as name, count(*) as n
  from videos v
  where v.vid_preacher is not null and btrim(v.vid_preacher) <> ''
    and btrim(v.vid_preacher) not in ('-', '<from the context or Unknown>')
  group by btrim(v.vid_preacher)
),
best_key as (
  -- single pass: most frequent plausible stored profile_id per name
  select name, profile_id as most_frequent_key
  from (
    select
      btrim(x.vid_preacher) as name,
      x.profile_id,
      rank() over (
        partition by btrim(x.vid_preacher)
        order by count(*) desc, x.profile_id
      ) as r
    from videos x
    where atp_profile_id_plausible(x.profile_id)
      and btrim(x.vid_preacher) not in ('-', '<from the context or Unknown>')
    group by btrim(x.vid_preacher), x.profile_id
  ) t
  where r = 1
)
select
  n.name,
  n.n,
  coalesce(bk.most_frequent_key, atp_profile_key_from_name(n.name))
from named n
left join best_key bk on bk.name = n.name;

-- ---------------------------------------------------------------------------
-- 1) categories backfill (one row per distinct non-empty vid_category)
-- ---------------------------------------------------------------------------
insert into categories (slug, name)
select
  btrim(v.vid_category),
  coalesce(nullif(max(btrim(nullif(v.search_category, ''))), ''), btrim(v.vid_category))
from videos v
where v.vid_category is not null and btrim(v.vid_category) <> ''
group by btrim(v.vid_category)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2) profiles backfill: one row per final profile key.
--    Canonical display name = most frequent vid_preacher label for that key
--    (so 'Bruce Mejia' + 'Pastor Bruce Mejia' collapse to one profile whose
--    name is whichever label appears most).
-- ---------------------------------------------------------------------------
with keyed as (
  select profile_key, name, video_count
  from atp_name_key_map
  where profile_key is not null and btrim(profile_key) <> ''
),
ranked as (
  select profile_key, name,
    rank() over (partition by profile_key order by video_count desc, name) as r
  from keyed
)
insert into profiles (profile_key, name, name_slug)
select profile_key, name, name
from ranked
where r = 1
on conflict (profile_key) do nothing;

-- home category = the vid_category with the most videos for that profile key
with cat_counts as (
  select
    m.profile_key,
    btrim(v.vid_category) as slug,
    count(*) as n,
    rank() over (partition by m.profile_key
                 order by count(*) desc, btrim(v.vid_category)) as r
  from videos v
  join atp_name_key_map m on m.name = btrim(v.vid_preacher)
  where v.vid_preacher is not null and btrim(v.vid_preacher) <> ''
    and v.vid_category is not null and btrim(v.vid_category) <> ''
    and m.profile_key is not null
  group by m.profile_key, btrim(v.vid_category)
)
update profiles p
set category_id = c.id
from cat_counts cc
join categories c on c.slug = cc.slug
where p.profile_key = cc.profile_key and cc.r = 1
  and p.category_id is distinct from c.id;

-- legacy main_category, most frequent non-empty per profile key
with mc as (
  select
    m.profile_key,
    btrim(v.main_category) as val,
    count(*) as n,
    rank() over (partition by m.profile_key
                 order by count(*) desc, btrim(v.main_category)) as r
  from videos v
  join atp_name_key_map m on m.name = btrim(v.vid_preacher)
  where v.vid_preacher is not null and btrim(v.vid_preacher) <> ''
    and v.main_category is not null and btrim(v.main_category) <> ''
    and m.profile_key is not null
  group by m.profile_key, btrim(v.main_category)
)
update profiles p
set main_category = mc.val
from mc
where p.profile_key = mc.profile_key and mc.r = 1
  and p.main_category is distinct from mc.val;

-- ---------------------------------------------------------------------------
-- 3) primary join rows backfill
-- ---------------------------------------------------------------------------
insert into video_categories (video_id, category_id, is_primary, source)
select v.id, c.id, true, 'import'
from videos v
join categories c on c.slug = btrim(v.vid_category)
where v.vid_category is not null and btrim(v.vid_category) <> ''
on conflict (video_id, category_id) do nothing;

insert into video_profiles (video_id, profile_id, is_primary, source)
select v.id, p.id, true, 'import'
from videos v
join atp_name_key_map m on m.name = btrim(v.vid_preacher)
join profiles p on p.profile_key = m.profile_key
where v.vid_preacher is not null and btrim(v.vid_preacher) <> ''
  and m.profile_key is not null
on conflict (video_id, profile_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4) sync trigger A: join-table primary change -> legacy videos columns
--    (guarded: only writes when the value actually differs -> no loops)
-- ---------------------------------------------------------------------------
create or replace function atp_sync_videos_from_profile()
returns trigger
language plpgsql
as $$
declare
  v_id integer;
  p    profiles%rowtype;
begin
  v_id := case when tg_op = 'DELETE' then old.video_id else new.video_id end;
  select p1.* into p from video_profiles vp
         join profiles p1 on p1.id = vp.profile_id
         where vp.video_id = v_id and vp.is_primary
         limit 1;
  if found then
    update videos set
      vid_preacher = p.name,
      profile_id   = p.profile_key
    where id = v_id
      and (btrim(vid_preacher) is distinct from p.name
           or nullif(profile_id, '') is distinct from p.profile_key);
  end if;
  return null;
end;
$$;

drop trigger if exists video_profiles_sync_videos on video_profiles;
create trigger video_profiles_sync_videos
after insert or update or delete on video_profiles
for each row execute function atp_sync_videos_from_profile();

create or replace function atp_sync_videos_from_category()
returns trigger
language plpgsql
as $$
declare
  v_id integer;
  c    categories%rowtype;
begin
  v_id := case when tg_op = 'DELETE' then old.video_id else new.video_id end;
  select c1.* into c from video_categories vc
         join categories c1 on c1.id = vc.category_id
         where vc.video_id = v_id and vc.is_primary
         limit 1;
  if found then
    update videos set
      vid_category    = c.slug,
      search_category = c.name
    where id = v_id
      and (btrim(vid_category) is distinct from c.slug
           or btrim(coalesce(search_category, '')) is distinct from c.name);
  end if;
  return null;
end;
$$;

drop trigger if exists video_categories_sync_videos on video_categories;
create trigger video_categories_sync_videos
after insert or update or delete on video_categories
for each row execute function atp_sync_videos_from_category();

-- ---------------------------------------------------------------------------
-- 5) sync trigger B: legacy videos columns change -> upsert join tables
--    (this is what makes ATP-manager stage-5 plain INSERTs keep the new
--     schema in sync without pipeline changes)
--    Note: ON CONFLICT DO NOTHING on purpose -- the canonical profile
--    category name is set once (by the first video that creates the row);
--    later label variants must not rewrite it.
-- ---------------------------------------------------------------------------
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
  -- category side
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
      insert into profiles (profile_key, name, name_slug)
      values (v_prof_key, v_prof_name, v_prof_name)
      on conflict (profile_key) do nothing;
      select id into v_prof_id from profiles where profile_key = v_prof_key;
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

drop trigger if exists videos_sync_join_tables on videos;
create trigger videos_sync_join_tables
after insert or update of vid_category, search_category, vid_preacher, profile_id on videos
for each row execute function atp_sync_join_tables_from_videos();

-- cleanup (temp table; kept explicit so re-runs in the same session are clean)
drop table if exists atp_name_key_map;
