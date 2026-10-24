-- Challenges. Run once in the Supabase SQL editor, after campaigns.sql and donations.sql.
--
-- A challenge is a short, time-boxed push for a campaign, hosted by a logged-in
-- user. Challenges never hold money: a challenge donation is an ordinary row in
-- public.donations with challenge_id set, so the campaign total (kept by the
-- trigger in donations.sql) counts it exactly once. Challenge totals are always
-- summed from donations (see the challenge_totals view); nothing is stored.
--
-- Lifecycle:
--   pending   → waiting for the campaign organiser (challenges the organiser
--               creates on their own campaign skip this and go live at once)
--   declined  → never runs
--   approved  → live until ends_at. KSh 100 / KSh 50 challenges start their
--               countdown at approval. Mgeni Rasmi starts it when the host makes
--               the first gift; if the host hasn't given within 24 hours of
--               approval, it expires.
-- "Live", "ended" and "expired" are worked out from the timestamps, not stored.

create table public.challenges (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  host_id        uuid not null references auth.users (id) on delete cascade default auth.uid(),
  host_name      text not null check (char_length(host_name) between 1 and 60),  -- shown on the page
  type           text not null check (type in ('mgeni_rasmi', 'ksh_100', 'ksh_50')),
  duration_minutes integer not null
                 check (duration_minutes between 30 and 43200),  -- 30 minutes to 30 days
  target         integer check (target is null or target between 100 and 50000000),  -- KES, optional
  status         text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  approved_at    timestamptz,
  starts_at      timestamptz,  -- when the countdown started
  ends_at        timestamptz,  -- starts_at + duration
  host_gift      integer,      -- Mgeni Rasmi: the host's first donation (KES)
  created_at     timestamptz not null default now()
);

create index challenges_campaign_id_created_at_idx
  on public.challenges (campaign_id, created_at desc);

-- Is this challenge taking up a live slot right now? A Mgeni Rasmi waiting for
-- the host's first gift counts, so two can't be approved side by side.
create function public.challenge_is_active(c public.challenges)
returns boolean
language sql
stable
set search_path = ''
as $$
  select c.status = 'approved'
     and case
           when c.ends_at is not null then c.ends_at > now()
           else c.approved_at > now() - interval '24 hours'
         end;
$$;

-- Raises an error if letting this challenge go live would break a limit:
-- one live challenge per host per campaign, one live Mgeni Rasmi per campaign,
-- at most 5 live challenges per campaign. Callers must hold a lock on the
-- campaign row so two approvals can't both squeeze past.
create function public.check_challenge_limits(
  p_campaign_id uuid, p_host_id uuid, p_type text, p_exclude_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.challenges c
     where c.campaign_id = p_campaign_id and c.host_id = p_host_id
       and c.id is distinct from p_exclude_id and public.challenge_is_active(c)
  ) then
    raise exception 'already_hosting';
  end if;

  if p_type = 'mgeni_rasmi' and exists (
    select 1 from public.challenges c
     where c.campaign_id = p_campaign_id and c.type = 'mgeni_rasmi'
       and c.id is distinct from p_exclude_id and public.challenge_is_active(c)
  ) then
    raise exception 'mgeni_rasmi_taken';
  end if;

  if (
    select count(*) from public.challenges c
     where c.campaign_id = p_campaign_id
       and c.id is distinct from p_exclude_id and public.challenge_is_active(c)
  ) >= 5 then
    raise exception 'campaign_full';
  end if;
end;
$$;

-- Row-level security ---------------------------------------------------------

alter table public.challenges enable row level security;

-- Anyone can read challenges: pending pages show "Waiting for organiser approval".
create policy "Challenges are public"
  on public.challenges for select
  to anon, authenticated
  using (true);

-- Logged-in users can create challenges, but only as themselves.
create policy "Users host their own challenges"
  on public.challenges for insert
  to authenticated
  with check (host_id = (select auth.uid()));

-- No update or delete policies: status only changes through review_challenge()
-- and the donation trigger below, which run with elevated rights.

revoke insert, update, delete on public.challenges from anon, authenticated;
grant insert (campaign_id, slug, host_name, type, duration_minutes, target)
  on public.challenges to authenticated;

-- New challenges -------------------------------------------------------------
-- Forces every new challenge to start as pending, enforces one pending-or-live
-- challenge per host per campaign, and puts the organiser's own challenges
-- live straight away (still subject to the limits).

create function public.prepare_new_challenge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organiser_id uuid;
begin
  new.host_id     := auth.uid();
  new.status      := 'pending';
  new.approved_at := null;
  new.starts_at   := null;
  new.ends_at     := null;
  new.host_gift   := null;
  new.created_at  := now();

  -- Lock the campaign so limit checks can't race each other.
  select organiser_id into v_organiser_id
    from public.campaigns where id = new.campaign_id
     for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if v_organiser_id is null then
    raise exception 'no_organiser';  -- nobody could ever approve it
  end if;

  if exists (
    select 1 from public.challenges c
     where c.campaign_id = new.campaign_id and c.host_id = new.host_id
       and (c.status = 'pending' or public.challenge_is_active(c))
  ) then
    raise exception 'already_hosting';
  end if;

  if new.host_id = v_organiser_id then
    perform public.check_challenge_limits(new.campaign_id, new.host_id, new.type, null);
    new.status      := 'approved';
    new.approved_at := now();
    if new.type <> 'mgeni_rasmi' then
      new.starts_at := now();
      new.ends_at   := now() + make_interval(mins => new.duration_minutes);
    end if;
  end if;

  return new;
end;
$$;

create trigger challenges_prepare_new
  before insert on public.challenges
  for each row execute function public.prepare_new_challenge();

-- Approving and declining ----------------------------------------------------
-- Called from the organiser dashboard: supabase.rpc('review_challenge', ...).

create function public.review_challenge(p_challenge_id uuid, p_approve boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.challenges;
  v_organiser_id uuid;
begin
  select * into ch from public.challenges where id = p_challenge_id;
  if not found then
    raise exception 'challenge_not_found';
  end if;

  select organiser_id into v_organiser_id
    from public.campaigns where id = ch.campaign_id
     for update;
  if auth.uid() is null or v_organiser_id is distinct from auth.uid() then
    raise exception 'not_organiser';
  end if;

  -- Re-read under the lock in case someone else reviewed it meanwhile.
  select * into ch from public.challenges where id = p_challenge_id for update;
  if ch.status <> 'pending' then
    raise exception 'not_pending';
  end if;

  if not p_approve then
    update public.challenges set status = 'declined' where id = ch.id;
    return 'declined';
  end if;

  perform public.check_challenge_limits(ch.campaign_id, ch.host_id, ch.type, ch.id);
  update public.challenges
     set status      = 'approved',
         approved_at = now(),
         starts_at   = case when ch.type = 'mgeni_rasmi' then null else now() end,
         ends_at     = case when ch.type = 'mgeni_rasmi' then null
                            else now() + make_interval(mins => ch.duration_minutes) end
   where id = ch.id;
  return 'approved';
end;
$$;

-- Only review_challenge is callable from the app; the helpers are internal.
revoke execute on function public.challenge_is_active(public.challenges) from public, anon, authenticated;
revoke execute on function public.check_challenge_limits(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.prepare_new_challenge() from public, anon, authenticated;
revoke execute on function public.review_challenge(uuid, boolean) from public, anon;
grant execute on function public.review_challenge(uuid, boolean) to authenticated;

-- Challenge donations --------------------------------------------------------
-- Donations stay campaign donations; challenge_id just says which challenge
-- brought them in. Direct donations leave it empty.

alter table public.donations
  add column challenge_id uuid references public.challenges (id) on delete set null;

create index donations_challenge_id_created_at_idx
  on public.donations (challenge_id, created_at desc)
  where challenge_id is not null;

grant insert (challenge_id) on public.donations to anon, authenticated;

-- Checks a challenge donation before it's saved: the challenge must belong to
-- the same campaign and be live, preset amounts are minimums, and a Mgeni
-- Rasmi's first gift must come from the host (which starts its countdown).
create function public.check_challenge_donation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.challenges;
begin
  if new.challenge_id is null then
    return new;
  end if;

  select * into ch from public.challenges where id = new.challenge_id for update;
  if not found or ch.campaign_id <> new.campaign_id then
    raise exception 'challenge_not_found';
  end if;
  if ch.status <> 'approved' then
    raise exception 'challenge_not_live';
  end if;

  if ch.type = 'mgeni_rasmi' and ch.host_gift is null then
    if ch.approved_at <= now() - interval '24 hours' then
      raise exception 'challenge_expired';
    end if;
    if auth.uid() is distinct from ch.host_id then
      raise exception 'waiting_for_host';
    end if;
    update public.challenges
       set host_gift = new.amount,
           starts_at = now(),
           ends_at   = now() + make_interval(mins => ch.duration_minutes)
     where id = ch.id;
    return new;
  end if;

  if ch.ends_at <= now() then
    raise exception 'challenge_ended';
  end if;
  if (ch.type = 'ksh_100' and new.amount < 100) or (ch.type = 'ksh_50' and new.amount < 50) then
    raise exception 'below_preset';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_challenge_donation() from public, anon, authenticated;

create trigger donations_check_challenge
  before insert on public.donations
  for each row execute function public.check_challenge_donation();

-- Challenge totals -----------------------------------------------------------
-- Always summed from donations, never stored.

create view public.challenge_totals
with (security_invoker = true)
as
  select challenge_id,
         sum(amount)::integer as raised,
         count(*)::integer    as donor_count
    from public.donations
   where challenge_id is not null
   group by challenge_id;

grant select on public.challenge_totals to anon, authenticated;

-- Realtime -------------------------------------------------------------------
-- Lets an open challenge page switch to live the moment it's approved.

alter publication supabase_realtime add table public.challenges;
