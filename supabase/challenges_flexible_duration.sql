-- Flexible challenge durations. Run once in the Supabase SQL editor, after challenges.sql.
--
-- Replaces duration_hours (1, 24 or 168) with duration_minutes (30 minutes to
-- 30 days). Existing challenges are kept: their hours are converted to minutes.
-- challenges.sql already has these changes, so a fresh setup doesn't need this file.

begin;

-- Drop the old "1, 24 or 168" check, whatever Postgres named it.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
     where conrelid = 'public.challenges'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%duration_hours%'
  loop
    execute format('alter table public.challenges drop constraint %I', v_name);
  end loop;
end;
$$;

-- Renaming keeps the column's insert permission for logged-in users.
alter table public.challenges rename column duration_hours to duration_minutes;

update public.challenges set duration_minutes = duration_minutes * 60;

alter table public.challenges
  add constraint challenges_duration_minutes_check
  check (duration_minutes between 30 and 43200);  -- 30 minutes to 30 days

-- Functions that use the duration ---------------------------------------------
-- Same as in challenges.sql, with make_interval(mins => duration_minutes).
-- "create or replace" keeps their existing permissions and triggers.

create or replace function public.prepare_new_challenge()
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

create or replace function public.review_challenge(p_challenge_id uuid, p_approve boolean)
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

create or replace function public.check_challenge_donation()
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

commit;
