-- Demo data support. Run once in the Supabase SQL editor, after
-- viral_any_category.sql, and before deploying the code that reads is_demo.
--
-- - is_demo marks the showcase records created by scripts/demo/seed.mjs, so
--   they can be found, labelled "Demo" on the site, and removed by
--   scripts/demo/remove.mjs. Only the secret key (or the SQL editor) can set
--   it: it's in none of the column grants for the app.
-- - Demo users are marked in auth.users with app_metadata.is_demo, which only
--   the secret key can set.
-- - Two narrow exceptions for demo rows, nothing else changes:
--   * payout numbers of demo campaigns can be removed (with their campaign);
--     real payout numbers stay locked
--   * when a row is tagged as demo, the seed may set its updated_at, so
--     backdated updates don't all show "Edited"

begin;

alter table public.campaigns        add column is_demo boolean not null default false;
alter table public.donations        add column is_demo boolean not null default false;
alter table public.challenges       add column is_demo boolean not null default false;
alter table public.campaign_updates add column is_demo boolean not null default false;

create index campaigns_is_demo_idx        on public.campaigns (id)        where is_demo;
create index donations_is_demo_idx        on public.donations (id)        where is_demo;
create index challenges_is_demo_idx       on public.challenges (id)       where is_demo;
create index campaign_updates_is_demo_idx on public.campaign_updates (id) where is_demo;

-- Same as in beneficiary_verification.sql, except demo campaigns' payout
-- numbers can change or go, so the demo can be removed and re-seeded.
create or replace function public.lock_payout_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.campaigns where id = old.campaign_id and is_demo) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'payout_phone_locked';
end;
$$;

-- Same as in updates.sql, except the one write that tags a row as demo keeps
-- the updated_at it sets (the seed backdates updates).
create or replace function public.touch_campaign_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_demo and not old.is_demo then
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

commit;
