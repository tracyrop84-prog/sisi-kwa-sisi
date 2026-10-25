-- Phase 5: reporting and admin review.
-- Run once in the Supabase SQL editor, after update_types_by_category.sql.
--
-- - admins: who can review reports. Set only here, never through the app:
--     insert into public.admins (user_id)
--     select id from auth.users where email = 'you@example.com';
-- - campaigns.status: active, paused (under review, no donations) or closed
--   (fraud confirmed, permanent)
-- - reports: one open report per user per campaign, readable only by admins.
--   A campaign pauses automatically at 3 open reports.
-- - donations.status: completed, or to_be_refunded once a campaign is closed.
--   Payments are MOCK, so this is only a status until Phase 7.
-- - Organiser safeguards: a declaration accepted with every new campaign, at
--   most 2 active (or paused) campaigns per organiser, and the beneficiary
--   locked once the first donation arrives.

begin;

-- Admins ----------------------------------------------------------------------

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- No policies: the app can never read or change who is an admin.
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- True when the logged-in user is an admin.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Campaign status -------------------------------------------------------------
-- Not in the column grants (campaigns.sql), so organisers can't change it. It
-- only changes through the report trigger and the admin functions below.

alter table public.campaigns
  add column status text not null default 'active'
    constraint campaigns_status_check check (status in ('active', 'paused', 'closed')),
  add column paused_at timestamptz,
  add column closed_at timestamptz;

create index campaigns_status_idx on public.campaigns (status) where status <> 'active';

-- Organisers can't edit or delete a campaign while it's under review or closed.
alter policy "Organisers update their own campaigns"
  on public.campaigns
  using (organiser_id = (select auth.uid()) and status = 'active')
  with check (organiser_id = (select auth.uid()) and status = 'active');

alter policy "Organisers delete their own campaigns"
  on public.campaigns
  using (organiser_id = (select auth.uid()) and status = 'active');

-- Same as in updates.sql, plus: not once the campaign is closed. This stops
-- organisers posting, editing or deleting updates and photos on a closed campaign.
create or replace function public.is_campaign_organiser(p_campaign_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_campaign_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      exists (
        select 1 from public.campaigns
         where id = p_campaign_id::uuid and organiser_id = auth.uid() and status <> 'closed'
      ) and public.email_confirmed()
    else false
  end;
$$;

-- No donations or new challenges unless the campaign is active. Shared by
-- donations and challenges (both have campaign_id). The lock means a donation
-- can't slip in while the campaign is being paused.
create function public.check_campaign_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.campaigns where id = new.campaign_id for update;
  if v_status = 'paused' then
    raise exception 'campaign_paused';
  end if;
  if v_status = 'closed' then
    raise exception 'campaign_closed';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_campaign_open() from public, anon, authenticated;

-- Before-triggers run in name order, so these run before donations_check_challenge
-- and challenges_prepare_new.
create trigger donations_check_campaign_open
  before insert on public.donations
  for each row execute function public.check_campaign_open();

create trigger challenges_check_campaign_open
  before insert on public.challenges
  for each row execute function public.check_campaign_open();

-- Donation status ------------------------------------------------------------
-- Not in the insert grants (donations.sql), so donors can't set it.

alter table public.donations
  add column status text not null default 'completed'
    constraint donations_status_check check (status in ('completed', 'to_be_refunded'));

-- Reports ---------------------------------------------------------------------

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  -- Campaigns with reports can't be deleted, so the record stays.
  campaign_id  uuid not null references public.campaigns (id) on delete restrict,
  -- Kept if the reporter deletes their account.
  reporter_id  uuid references auth.users (id) on delete set null default auth.uid(),
  -- Keep in sync with REPORT_REASONS in src/lib/reports.ts.
  reason       text not null
               check (reason in ('scam', 'impersonation', 'misuse', 'inappropriate', 'other')),
  details      text check (details is null or char_length(details) between 1 and 1000),
  status       text not null default 'open' check (status in ('open', 'resolved')),
  resolution   text check (resolution in ('cleared', 'fraud')),
  resolved_by  uuid references auth.users (id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),

  constraint reports_resolution_when_resolved check ((status = 'resolved') = (resolution is not null))
);

-- One open report per user per campaign. Once an admin clears a campaign, its
-- reports are resolved and people can report it again.
create unique index reports_one_open_per_user
  on public.reports (campaign_id, reporter_id)
  where status = 'open';

create index reports_campaign_id_created_at_idx
  on public.reports (campaign_id, created_at desc);

alter table public.reports enable row level security;

-- Reporters stay anonymous: only admins can read reports, organisers never.
create policy "Admins read reports"
  on public.reports for select
  to authenticated
  using ((select public.is_admin()));

create policy "Confirmed users report campaigns"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()) and (select public.email_confirmed()));

-- No update or delete policies: reports only change through the admin functions.
revoke insert, update, delete on public.reports from anon, authenticated;
grant insert (campaign_id, reason, details) on public.reports to authenticated;

-- Fills in everything but the reason and details, and refuses reports on your
-- own campaign or a closed one.
create function public.prepare_new_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organiser_id uuid;
  v_status text;
begin
  new.reporter_id := auth.uid();
  new.status      := 'open';
  new.resolution  := null;
  new.resolved_by := null;
  new.resolved_at := null;
  new.created_at  := now();

  -- Lock the campaign so two reports can't both miss the auto-pause count.
  select organiser_id, status into v_organiser_id, v_status
    from public.campaigns where id = new.campaign_id
     for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if v_organiser_id = new.reporter_id then
    raise exception 'own_campaign';
  end if;
  if v_status = 'closed' then
    raise exception 'campaign_closed';
  end if;
  return new;
end;
$$;

create trigger reports_prepare_new
  before insert on public.reports
  for each row execute function public.prepare_new_report();

-- Pauses an active campaign once 3 different users have open reports on it.
create function public.pause_reported_campaign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.reports
     where campaign_id = new.campaign_id and status = 'open'
  ) >= 3 then
    update public.campaigns
       set status = 'paused', paused_at = now()
     where id = new.campaign_id and status = 'active';
  end if;
  return null;
end;
$$;

create trigger reports_pause_campaign
  after insert on public.reports
  for each row execute function public.pause_reported_campaign();

revoke execute on function public.prepare_new_report() from public, anon, authenticated;
revoke execute on function public.pause_reported_campaign() from public, anon, authenticated;

-- Whether the logged-in user has an open report on this campaign, so the page
-- can say so. Never reveals anyone else's reports.
create function public.has_reported(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reports
     where campaign_id = p_campaign_id and reporter_id = auth.uid() and status = 'open'
  );
$$;

revoke execute on function public.has_reported(uuid) from public, anon;
grant execute on function public.has_reported(uuid) to authenticated;

-- Admin review ----------------------------------------------------------------
-- Called from /admin: supabase.rpc('admin_pause_campaign', ...) and friends.
-- A closed campaign can never be changed again.

-- Locks the campaign and returns its status, after checking the caller is an admin.
create function public.lock_campaign_for_review(p_campaign_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  select status into v_status from public.campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if v_status = 'closed' then
    raise exception 'campaign_closed';
  end if;
  return v_status;
end;
$$;

create function public.admin_pause_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.lock_campaign_for_review(p_campaign_id) = 'active' then
    update public.campaigns set status = 'paused', paused_at = now() where id = p_campaign_id;
  end if;
end;
$$;

-- Donations resume and open reports are marked resolved.
create function public.admin_clear_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_campaign_for_review(p_campaign_id);
  update public.campaigns set status = 'active', paused_at = null where id = p_campaign_id;
  update public.reports
     set status = 'resolved', resolution = 'cleared', resolved_by = auth.uid(), resolved_at = now()
   where campaign_id = p_campaign_id and status = 'open';
end;
$$;

-- Closes the campaign for good and marks all its donations to be refunded.
create function public.admin_confirm_fraud(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_campaign_for_review(p_campaign_id);
  update public.campaigns set status = 'closed', closed_at = now() where id = p_campaign_id;
  update public.donations set status = 'to_be_refunded' where campaign_id = p_campaign_id;
  update public.reports
     set status = 'resolved', resolution = 'fraud', resolved_by = auth.uid(), resolved_at = now()
   where campaign_id = p_campaign_id and status = 'open';
end;
$$;

revoke execute on function public.lock_campaign_for_review(uuid) from public, anon, authenticated;
revoke execute on function public.admin_pause_campaign(uuid) from public, anon;
revoke execute on function public.admin_clear_campaign(uuid) from public, anon;
revoke execute on function public.admin_confirm_fraud(uuid) from public, anon;
grant execute on function public.admin_pause_campaign(uuid) to authenticated;
grant execute on function public.admin_clear_campaign(uuid) to authenticated;
grant execute on function public.admin_confirm_fraud(uuid) to authenticated;

-- Organiser safeguards ---------------------------------------------------------

-- The declaration the organiser accepted (the exact text shown), and when.
-- Older campaigns and seeded sample rows have neither.
alter table public.campaigns
  add column declaration text
    constraint campaigns_declaration_check check (char_length(declaration) between 1 and 500),
  add column declaration_accepted_at timestamptz,
  add constraint campaigns_declaration_accepted check ((declaration is null) = (declaration_accepted_at is null));

-- The time is always set here, so it can't be backdated.
grant insert (declaration) on public.campaigns to authenticated;

-- For every campaign created from the app (they always have an organiser):
-- requires the declaration, stamps the time, and allows at most 2 campaigns per
-- organiser that are active or paused. Paused ones count, so a reported
-- organiser can't just start another.
create function public.prepare_new_campaign()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.declaration_accepted_at := case when new.declaration is null then null else now() end;
  if new.organiser_id is null then
    return new;  -- seeded sample rows, inserted in the SQL editor
  end if;

  if new.declaration is null then
    raise exception 'declaration_required';
  end if;

  -- One organiser's inserts take turns, so two at once can't both pass the count.
  perform pg_advisory_xact_lock(hashtext('new_campaign:' || new.organiser_id::text));
  if (
    select count(*) from public.campaigns
     where organiser_id = new.organiser_id and status in ('active', 'paused')
  ) >= 2 then
    raise exception 'campaign_limit';
  end if;
  return new;
end;
$$;

create trigger campaigns_prepare_new
  before insert on public.campaigns
  for each row execute function public.prepare_new_campaign();

-- Once a campaign has its first donation, the beneficiary can't change.
-- OLD is the row as locked for this update, so a donation landing at the same
-- moment is always counted.
create function public.lock_beneficiary()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.donor_count > 0 then
    raise exception 'beneficiary_locked';
  end if;
  return new;
end;
$$;

create trigger campaigns_lock_beneficiary
  before update of beneficiary on public.campaigns
  for each row when (old.beneficiary is distinct from new.beneficiary)
  execute function public.lock_beneficiary();

revoke execute on function public.prepare_new_campaign() from public, anon, authenticated;
revoke execute on function public.lock_beneficiary() from public, anon, authenticated;

commit;
