-- Update types by campaign category. Run once in the Supabase SQL editor, after updates.sql.
--
-- - Adds the new categories (Wedding, School Fees, Church & Faith, Business &
--   Empowerment, Farming, Housing, Sports & Youth, Elder Care).
-- - Recovery updates are only for Medical campaigns, progress updates for every
--   other category. Gift and general updates suit all.
--
-- Existing updates are kept: the rule is checked when an update is posted, so
-- older updates that break it stay and can still be edited or deleted. The
-- notice at the end lists any. campaigns.sql and updates.sql already have these
-- changes, so a fresh setup doesn't need this file.

begin;

-- Replace the category check, whatever Postgres named the old one.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
     where conrelid = 'public.campaigns'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%category%'
  loop
    execute format('alter table public.campaigns drop constraint %I', v_name);
  end loop;
end;
$$;

-- Keep in sync with src/lib/categories.ts.
alter table public.campaigns
  add constraint campaigns_category_check check (category in (
    'Medical', 'Education', 'School Fees', 'Funeral', 'Wedding', 'Emergency', 'Community',
    'Church & Faith', 'Business & Empowerment', 'Farming', 'Housing', 'Sports & Youth',
    'Elder Care', 'Other'));

-- Same as in updates.sql. -----------------------------------------------------

create or replace function public.check_update_type_for_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_category text;
begin
  select category into v_category from public.campaigns where id = new.campaign_id;
  if new.type = 'recovery' and v_category is distinct from 'Medical' then
    raise exception 'recovery_needs_medical_campaign';
  end if;
  if new.type = 'progress' and v_category = 'Medical' then
    raise exception 'progress_not_for_medical_campaign';
  end if;
  return new;
end;
$$;

drop trigger if exists campaign_updates_check_type on public.campaign_updates;
create trigger campaign_updates_check_type
  before insert on public.campaign_updates
  for each row execute function public.check_update_type_for_category();

create or replace function public.check_category_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.campaign_updates u
     where u.campaign_id = new.id
       and ((u.type = 'recovery' and new.category <> 'Medical')
         or (u.type = 'progress' and new.category = 'Medical'))
  ) then
    raise exception 'category_conflicts_with_updates';
  end if;
  return new;
end;
$$;

drop trigger if exists campaigns_check_category_change on public.campaigns;
create trigger campaigns_check_category_change
  before update of category on public.campaigns
  for each row when (old.category is distinct from new.category)
  execute function public.check_category_change();

-- List existing updates that break the rule (they are not changed).
do $$
declare
  r record;
begin
  for r in
    select u.id, u.type, c.slug, c.category
      from public.campaign_updates u
      join public.campaigns c on c.id = u.campaign_id
     where (u.type = 'recovery' and c.category <> 'Medical')
        or (u.type = 'progress' and c.category = 'Medical')
  loop
    raise notice 'Kept, but breaks the new rule: % update % on % (%)', r.type, r.id, r.slug, r.category;
  end loop;
end;
$$;

commit;
