-- Phase 6 step 2: empowerment campaigns and beneficiary verification.
-- Run once in the Supabase SQL editor, after goal_edits.sql.
--
-- - Viral campaigns: Business & Empowerment campaigns can link the original
--   video (TikTok, Facebook, Instagram or YouTube). Set when creating, never
--   changed afterwards.
-- - Beneficiary confirmation: required for viral campaigns, optional for any
--   other. The campaign waits in status 'awaiting_beneficiary' (not public, no
--   donations, details locked) until the beneficiary opens /confirm/[token]
--   from an SMS, enters the 6-digit code and agrees. Same code rules as phone
--   verification (10 minutes, 5 attempts, resend once a minute); the link
--   expires after 7 days. Tokens are SHA-256 hashed, codes bcrypt-hashed.
-- - "This isn't me / I don't agree" closes the campaign and lists it for admins.
-- - Once confirmed, the campaign goes live (or to approval for big goals) with
--   a "Verified" badge, the beneficiary can't change, and their number is kept
--   as the payout number: only admins can read it and nobody can change it.
-- - One open viral campaign per payout number.
-- - Story or goal edits on a confirmed campaign are queued so the app can text
--   the beneficiary.
-- - Only the server (with the secret key) can call the beneficiary functions,
--   since the beneficiary has no account.

begin;

-- Campaigns -------------------------------------------------------------------

alter table public.campaigns drop constraint campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check
    check (status in ('active', 'paused', 'closed', 'completed', 'pending', 'changes_requested', 'awaiting_beneficiary'));

alter table public.campaigns
  -- Keep in sync with src/lib/videoLinks.ts.
  add column viral_video_url text
    constraint campaigns_viral_video_url_check check (
      viral_video_url is null or (
        char_length(viral_video_url) <= 500
        and (viral_video_url ~ '^https://([a-z0-9-]+\.)?(tiktok|facebook|instagram|youtube)\.com/[^[:space:]]+$'
          or viral_video_url ~ '^https://(fb\.watch|youtu\.be)/[^[:space:]]+$')
      )
    ),
  add column beneficiary_confirmation boolean not null default false,
  -- Set only by beneficiary_confirm below, for the badge.
  add column beneficiary_confirmed_name text,
  add column beneficiary_confirmed_at timestamptz,
  -- Set only by beneficiary_decline below.
  add column beneficiary_declined_at timestamptz,
  add constraint campaigns_viral_category_check
    check (viral_video_url is null or category = 'Business & Empowerment'),
  add constraint campaigns_viral_confirmation_check
    check (viral_video_url is null or beneficiary_confirmation);

grant insert (viral_video_url, beneficiary_confirmation) on public.campaigns to authenticated;

alter policy "Campaigns are public"
  on public.campaigns
  using (status not in ('pending', 'changes_requested', 'awaiting_beneficiary'));

-- While waiting for the beneficiary, only the cover photo can change (see
-- lock_details_while_awaiting below), so they agree to exactly what they see.
alter policy "Organisers update their own campaigns"
  on public.campaigns
  using (organiser_id = (select auth.uid()) and status in ('active', 'pending', 'changes_requested', 'awaiting_beneficiary'))
  with check (organiser_id = (select auth.uid()) and status in ('active', 'pending', 'changes_requested', 'awaiting_beneficiary'));

alter policy "Organisers delete their own campaigns"
  on public.campaigns
  using (organiser_id = (select auth.uid()) and status in ('active', 'pending', 'changes_requested', 'awaiting_beneficiary'));

create function public.lock_details_while_awaiting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and old.status = 'awaiting_beneficiary' then
    raise exception 'details_locked';
  end if;
  return new;
end;
$$;

create trigger campaigns_lock_details_while_awaiting
  before update of title, category, organiser, beneficiary, location, goal, story on public.campaigns
  for each row execute function public.lock_details_while_awaiting();

revoke execute on function public.lock_details_while_awaiting() from public, anon, authenticated;

-- Same as in reports.sql, plus: who the money is for can't change once the
-- beneficiary has confirmed.
create or replace function public.lock_beneficiary()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.donor_count > 0 or old.beneficiary_confirmed_at is not null then
    raise exception 'beneficiary_locked';
  end if;
  return new;
end;
$$;

-- Same as in organiser_verification.sql, plus campaigns waiting for the beneficiary.
create or replace function public.check_campaign_open()
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
  if v_status = 'completed' then
    raise exception 'campaign_completed';
  end if;
  if v_status in ('pending', 'changes_requested', 'awaiting_beneficiary') then
    raise exception 'campaign_not_live';
  end if;
  return new;
end;
$$;

-- Same as in organiser_verification.sql, plus campaigns waiting for the beneficiary.
create or replace function public.prepare_new_report()
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
  if v_status in ('pending', 'changes_requested', 'awaiting_beneficiary') then
    raise exception 'campaign_not_found';
  end if;
  return new;
end;
$$;

-- Same as in organiser_verification.sql, plus: viral campaigns always wait for
-- the beneficiary, as do others that ask for it, and those count toward the limit.
create or replace function public.prepare_new_campaign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text := new.slug;
  v_n    integer := 2;
begin
  new.declaration_accepted_at := case when new.declaration is null then null else now() end;
  if new.organiser_id is null then
    return new;  -- seeded sample rows, inserted in the SQL editor
  end if;

  if new.declaration is null then
    raise exception 'declaration_required';
  end if;
  if not exists (select 1 from public.organiser_phones where user_id = new.organiser_id) then
    raise exception 'phone_not_verified';
  end if;
  if new.goal > 100000 and not public.organiser_is_trusted(new.organiser_id) then
    raise exception 'goal_too_high';
  end if;

  -- One organiser's inserts take turns, so two at once can't both pass the count.
  perform pg_advisory_xact_lock(hashtext('new_campaign:' || new.organiser_id::text));
  if (
    select count(*) from public.campaigns
     where organiser_id = new.organiser_id and status in ('active', 'paused', 'pending', 'awaiting_beneficiary')
  ) >= 2 then
    raise exception 'campaign_limit';
  end if;

  new.beneficiary_confirmation := new.beneficiary_confirmation or new.viral_video_url is not null;
  new.status := case
    when new.beneficiary_confirmation then 'awaiting_beneficiary'
    when new.goal > 500000 then 'pending'
    else 'active'
  end;

  -- The app picks a free slug, but can't see other organisers' unpublished
  -- campaigns, so make sure here.
  while exists (select 1 from public.campaigns where slug = new.slug) loop
    new.slug := v_base || '-' || v_n;
    v_n := v_n + 1;
  end loop;
  return new;
end;
$$;

-- Same as in organiser_verification.sql, plus campaigns waiting for the
-- beneficiary count toward the limit.
create or replace function public.resubmit_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organiser_id uuid;
  v_status text;
begin
  select organiser_id, status into v_organiser_id, v_status
    from public.campaigns where id = p_campaign_id
     for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if auth.uid() is null or v_organiser_id is distinct from auth.uid() or not public.email_confirmed() then
    raise exception 'not_organiser';
  end if;
  if v_status <> 'changes_requested' then
    raise exception 'not_changes_requested';
  end if;

  -- Changes-requested campaigns don't count toward the limit, so check again.
  perform pg_advisory_xact_lock(hashtext('new_campaign:' || v_organiser_id::text));
  if (
    select count(*) from public.campaigns
     where organiser_id = v_organiser_id and status in ('active', 'paused', 'pending', 'awaiting_beneficiary')
  ) >= 2 then
    raise exception 'campaign_limit';
  end if;

  update public.campaigns set status = 'pending' where id = p_campaign_id;
end;
$$;

-- Payout numbers --------------------------------------------------------------

-- The beneficiary's confirmed number. Phase 7 payouts only ever go here.
create table public.payout_phones (
  -- Like reports, the record stays: a confirmed campaign can't be deleted.
  campaign_id  uuid primary key references public.campaigns (id) on delete restrict,
  phone        text not null check (phone ~ '^\+254[17][0-9]{8}$'),
  name         text not null,
  confirmed_at timestamptz not null default now()
);

create index payout_phones_phone_idx on public.payout_phones (phone);

alter table public.payout_phones enable row level security;

create policy "Admins read payout numbers"
  on public.payout_phones for select
  to authenticated
  using ((select public.is_admin()));

-- Only written by beneficiary_confirm below.
revoke all on public.payout_phones from anon, authenticated;
grant select on public.payout_phones to authenticated;

-- Never changes once confirmed, not even with the secret key.
create function public.lock_payout_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'payout_phone_locked';
end;
$$;

create trigger payout_phones_locked
  before update or delete on public.payout_phones
  for each row execute function public.lock_payout_phone();

revoke execute on function public.lock_payout_phone() from public, anon, authenticated;

-- True when this number is the payout number of another viral campaign that's
-- still open (not closed or completed).
create function public.viral_phone_in_use(p_phone text, p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payout_phones p
      join public.campaigns c on c.id = p.campaign_id
     where p.phone = p_phone
       and c.id <> p_campaign_id
       and c.viral_video_url is not null
       and c.status not in ('closed', 'completed')
  );
$$;

revoke execute on function public.viral_phone_in_use(text, uuid) from public, anon, authenticated;

-- Confirmation links ----------------------------------------------------------

-- One link per campaign. Kept after the beneficiary answers, so an old link
-- says so instead of looking broken. No policies or grants: only the
-- functions below can read it.
create table public.beneficiary_verifications (
  campaign_id     uuid primary key references public.campaigns (id) on delete cascade,
  name            text not null check (char_length(name) between 2 and 100),
  phone           text not null check (phone ~ '^\+254[17][0-9]{8}$'),
  token_hash      text not null unique,
  link_expires_at timestamptz not null,
  code_hash       text not null,
  code_expires_at timestamptz not null,
  attempts        integer not null default 0,
  sent_at         timestamptz not null,
  outcome         text check (outcome in ('confirmed', 'declined')),
  answered_at     timestamptz
);

alter table public.beneficiary_verifications enable row level security;
revoke all on public.beneficiary_verifications from anon, authenticated;

-- A random 6-digit code, the same way as issue_phone_code.
create function public.random_phone_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_bytes bytea := extensions.gen_random_bytes(4);
begin
  return lpad((
    (get_byte(v_bytes, 0)::bigint * 16777216
      + get_byte(v_bytes, 1) * 65536
      + get_byte(v_bytes, 2) * 256
      + get_byte(v_bytes, 3)) % 1000000
  )::text, 6, '0');
end;
$$;

create function public.token_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

revoke execute on function public.random_phone_code() from public, anon, authenticated;
revoke execute on function public.token_hash(text) from public, anon, authenticated;

-- Raises the reason this number can't be the beneficiary's, if any. The
-- create form calls it before inserting, so most problems show up before the
-- campaign exists; issue_beneficiary_link checks again.
create function public.check_beneficiary_phone(p_user_id uuid, p_phone text, p_viral boolean)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_phone is null or p_phone !~ '^\+254[17][0-9]{8}$' then
    raise exception 'invalid_phone';
  end if;
  -- The organiser can't confirm their own harambee.
  if exists (select 1 from public.organiser_phones where user_id = p_user_id and phone = p_phone) then
    raise exception 'own_phone';
  end if;
  if p_viral and public.viral_phone_in_use(p_phone, '00000000-0000-0000-0000-000000000000') then
    raise exception 'beneficiary_has_viral_campaign';
  end if;
end;
$$;

revoke execute on function public.check_beneficiary_phone(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.check_beneficiary_phone(uuid, text, boolean) to service_role;

-- Creates a new link and code for the beneficiary of this campaign and returns
-- them, so the server can send them by SMS. Also used to resend, or to change
-- the number: the old link stops working. The server passes the logged-in
-- user's id.
create function public.issue_beneficiary_link(p_user_id uuid, p_campaign_id uuid, p_name text, p_phone text)
returns table (token text, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text := btrim(coalesce(p_name, ''));
  v_token  text := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_code   text := public.random_phone_code();
  v_c      public.campaigns;
  v_sent   timestamptz;
begin
  if char_length(v_name) not between 2 and 100 then
    raise exception 'invalid_name';
  end if;

  select * into v_c from public.campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if v_c.organiser_id is distinct from p_user_id then
    raise exception 'not_organiser';
  end if;
  if v_c.status <> 'awaiting_beneficiary' then
    raise exception 'not_awaiting_beneficiary';
  end if;
  perform public.check_beneficiary_phone(p_user_id, p_phone, v_c.viral_video_url is not null);

  -- The campaign is locked, so two requests at once can't both send.
  select sent_at into v_sent from public.beneficiary_verifications where campaign_id = p_campaign_id;
  if v_sent > now() - interval '1 minute' then
    raise exception 'resend_too_soon';
  end if;

  insert into public.beneficiary_verifications as v
    (campaign_id, name, phone, token_hash, link_expires_at, code_hash, code_expires_at, attempts, sent_at)
  values
    (p_campaign_id, v_name, p_phone, public.token_hash(v_token), now() + interval '7 days',
     extensions.crypt(v_code, extensions.gen_salt('bf')), now() + interval '10 minutes', 0, now())
  on conflict (campaign_id) do update
    set name            = excluded.name,
        phone           = excluded.phone,
        token_hash      = excluded.token_hash,
        link_expires_at = excluded.link_expires_at,
        code_hash       = excluded.code_hash,
        code_expires_at = excluded.code_expires_at,
        attempts        = 0,
        sent_at         = excluded.sent_at;

  return query select v_token, v_code;
end;
$$;

revoke execute on function public.issue_beneficiary_link(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.issue_beneficiary_link(uuid, uuid, text, text) to service_role;

-- For the organiser's "waiting for confirmation" panel and the admin page.
-- The organiser typed the number in, so they can see it.
create function public.beneficiary_link_status(p_campaign_id uuid)
returns table (name text, phone text, sent_at timestamptz, link_expires_at timestamptz, outcome text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.name, v.phone, v.sent_at, v.link_expires_at, v.outcome
    from public.beneficiary_verifications v
   where v.campaign_id = p_campaign_id
     and (public.is_campaign_organiser(p_campaign_id::text) or public.is_admin());
$$;

revoke execute on function public.beneficiary_link_status(uuid) from public, anon;
grant execute on function public.beneficiary_link_status(uuid) to authenticated;

-- What the /confirm page may show before the code is entered: the title only.
-- status is 'open', 'invalid', 'link_expired', 'confirmed' or 'declined'.
create function public.beneficiary_link_title(p_token text)
returns table (status text, title text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(r.status, 'invalid'), r.title
    from (select 1) as one
    left join lateral (
      select case
               when v.outcome is not null then v.outcome
               when c.status <> 'awaiting_beneficiary' then 'invalid'
               when v.link_expires_at < now() then 'link_expired'
               else 'open'
             end as status,
             c.title
        from public.beneficiary_verifications v
        join public.campaigns c on c.id = v.campaign_id
       where v.token_hash = public.token_hash(p_token)
    ) r on true;
$$;

revoke execute on function public.beneficiary_link_title(text) from public, anon, authenticated;
grant execute on function public.beneficiary_link_title(text) to service_role;

-- Finds the link, locks its campaign and then the link itself (the same order
-- as issue_beneficiary_link), and says whether it can still be answered:
-- 'open', 'invalid', 'link_expired', 'confirmed' or 'declined'. The caller
-- then reads the locked row by its token hash.
create function public.lock_beneficiary_link(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_status      text;
  v             public.beneficiary_verifications;
begin
  select campaign_id into v_campaign_id
    from public.beneficiary_verifications where token_hash = public.token_hash(p_token);
  if not found then
    return 'invalid';
  end if;
  select status into v_status from public.campaigns where id = v_campaign_id for update;
  -- Re-read after locking: the organiser may have just sent a new link.
  select * into v from public.beneficiary_verifications
   where campaign_id = v_campaign_id and token_hash = public.token_hash(p_token)
     for update;
  if not found then
    return 'invalid';
  end if;
  return case
    when v.outcome is not null then v.outcome
    when v_status <> 'awaiting_beneficiary' then 'invalid'
    when v.link_expires_at < now() then 'link_expired'
    else 'open'
  end;
end;
$$;

revoke execute on function public.lock_beneficiary_link(text) from public, anon, authenticated;

-- Counts an attempt and checks the code: 'ok', 'wrong_code',
-- 'too_many_attempts' or 'expired'. The row must already be locked.
create function public.check_beneficiary_code(v public.beneficiary_verifications, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if v.code_expires_at < now() then
    return 'expired';
  end if;
  if v.attempts >= 5 then
    return 'too_many_attempts';
  end if;
  update public.beneficiary_verifications set attempts = attempts + 1 where campaign_id = v.campaign_id;
  if p_code is null or p_code !~ '^[0-9]{6}$' or extensions.crypt(p_code, v.code_hash) <> v.code_hash then
    return case when v.attempts + 1 >= 5 then 'too_many_attempts' else 'wrong_code' end;
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.check_beneficiary_code(public.beneficiary_verifications, text) from public, anon, authenticated;

-- A new code for the same link, at most once a minute. The link's 7 days
-- don't restart. Returns the number to text it to.
create function public.resend_beneficiary_code(p_token text)
returns table (phone text, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text;
  v      public.beneficiary_verifications;
  v_code text := public.random_phone_code();
begin
  v_link := public.lock_beneficiary_link(p_token);
  if v_link <> 'open' then
    raise exception '%', v_link;
  end if;
  select * into v from public.beneficiary_verifications where token_hash = public.token_hash(p_token);
  if v.sent_at > now() - interval '1 minute' then
    raise exception 'resend_too_soon';
  end if;
  update public.beneficiary_verifications
     set code_hash       = extensions.crypt(v_code, extensions.gen_salt('bf')),
         code_expires_at = now() + interval '10 minutes',
         attempts        = 0,
         sent_at         = now()
   where campaign_id = v.campaign_id;
  return query select v.phone, v_code;
end;
$$;

revoke execute on function public.resend_beneficiary_code(text) from public, anon, authenticated;
grant execute on function public.resend_beneficiary_code(text) to service_role;

-- Checks the code and, if it's right, returns what the beneficiary is asked to
-- agree to. Returns a result instead of raising, so a wrong attempt is still
-- counted: {result: 'ok' | 'wrong_code' | 'too_many_attempts' | 'expired' |
-- 'invalid' | 'link_expired' | 'confirmed' | 'declined', ...details when ok}.
create function public.beneficiary_check_code(p_token text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link   text;
  v        public.beneficiary_verifications;
  v_result text;
  v_c      public.campaigns;
begin
  v_link := public.lock_beneficiary_link(p_token);
  if v_link <> 'open' then
    return jsonb_build_object('result', v_link);
  end if;
  select * into v from public.beneficiary_verifications where token_hash = public.token_hash(p_token);
  v_result := public.check_beneficiary_code(v, p_code);
  if v_result <> 'ok' then
    return jsonb_build_object('result', v_result);
  end if;
  select * into v_c from public.campaigns where id = v.campaign_id;
  return jsonb_build_object(
    'result', 'ok',
    'name', v.name,
    'title', v_c.title,
    'story', v_c.story,
    'goal', v_c.goal,
    'organiser', v_c.organiser,
    'slug', v_c.slug
  );
end;
$$;

revoke execute on function public.beneficiary_check_code(text, text) from public, anon, authenticated;
grant execute on function public.beneficiary_check_code(text, text) to service_role;

-- The beneficiary agreed. Checks the code again, then: 'live' or
-- 'pending_approval' (goals over KES 500,000), or the same results as
-- beneficiary_check_code, or 'beneficiary_has_viral_campaign' / 'own_phone'.
create function public.beneficiary_confirm(p_token text, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link   text;
  v        public.beneficiary_verifications;
  v_result text;
  v_c      public.campaigns;
begin
  v_link := public.lock_beneficiary_link(p_token);
  if v_link <> 'open' then
    return v_link;
  end if;
  select * into v from public.beneficiary_verifications where token_hash = public.token_hash(p_token);
  v_result := public.check_beneficiary_code(v, p_code);
  if v_result <> 'ok' then
    return v_result;
  end if;
  select * into v_c from public.campaigns where id = v.campaign_id;

  if exists (select 1 from public.organiser_phones where user_id = v_c.organiser_id and phone = v.phone) then
    return 'own_phone';
  end if;
  if v_c.viral_video_url is not null then
    -- Confirmations for the same number take turns, so two can't both pass.
    perform pg_advisory_xact_lock(hashtext('viral_phone:' || v.phone));
    if public.viral_phone_in_use(v.phone, v_c.id) then
      return 'beneficiary_has_viral_campaign';
    end if;
  end if;

  insert into public.payout_phones (campaign_id, phone, name) values (v_c.id, v.phone, v.name);
  update public.beneficiary_verifications set outcome = 'confirmed', answered_at = now() where campaign_id = v_c.id;
  update public.campaigns
     set status = case when v_c.goal > 500000 then 'pending' else 'active' end,
         beneficiary_confirmed_name = v.name,
         beneficiary_confirmed_at = now()
   where id = v_c.id;
  return case when v_c.goal > 500000 then 'pending_approval' else 'live' end;
end;
$$;

revoke execute on function public.beneficiary_confirm(text, text) from public, anon, authenticated;
grant execute on function public.beneficiary_confirm(text, text) to service_role;

-- "This isn't me / I don't agree": closes the campaign for good. It never took
-- donations, so there's nothing to refund. Admins see it on the dashboard.
-- Returns 'declined', or 'invalid' / 'link_expired' / 'confirmed'.
create function public.beneficiary_decline(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text;
  v      public.beneficiary_verifications;
begin
  v_link := public.lock_beneficiary_link(p_token);
  if v_link <> 'open' then
    return v_link;
  end if;
  select * into v from public.beneficiary_verifications where token_hash = public.token_hash(p_token);
  update public.beneficiary_verifications set outcome = 'declined', answered_at = now() where campaign_id = v.campaign_id;
  update public.campaigns
     set status = 'closed', closed_at = now(), beneficiary_declined_at = now()
   where id = v.campaign_id;
  return 'declined';
end;
$$;

revoke execute on function public.beneficiary_decline(text) from public, anon, authenticated;
grant execute on function public.beneficiary_decline(text) to service_role;

-- Edit notices ----------------------------------------------------------------

-- Story or goal changes on a confirmed campaign, waiting to be texted to the
-- beneficiary. Recorded by the database, so an edit can't skip it.
create table public.beneficiary_edit_notices (
  id          bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create index beneficiary_edit_notices_unsent_idx
  on public.beneficiary_edit_notices (campaign_id) where sent_at is null;

alter table public.beneficiary_edit_notices enable row level security;
revoke all on public.beneficiary_edit_notices from anon, authenticated;

create function public.queue_beneficiary_edit_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One SMS covers every edit since the last one.
  if not exists (select 1 from public.beneficiary_edit_notices where campaign_id = new.id and sent_at is null) then
    insert into public.beneficiary_edit_notices (campaign_id) values (new.id);
  end if;
  return null;
end;
$$;

create trigger campaigns_queue_beneficiary_edit_notice
  after update of story, goal on public.campaigns
  for each row
  when (old.beneficiary_confirmed_at is not null
    and (old.story is distinct from new.story or old.goal is distinct from new.goal))
  execute function public.queue_beneficiary_edit_notice();

revoke execute on function public.queue_beneficiary_edit_notice() from public, anon, authenticated;

-- Marks this campaign's waiting notices as sent and returns the number to text,
-- or null if there's nothing to send.
create function public.claim_beneficiary_edit_notice(p_campaign_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.beneficiary_edit_notices set sent_at = now() where campaign_id = p_campaign_id and sent_at is null;
  if not found then
    return null;
  end if;
  return (select phone from public.payout_phones where campaign_id = p_campaign_id);
end;
$$;

revoke execute on function public.claim_beneficiary_edit_notice(uuid) from public, anon, authenticated;
grant execute on function public.claim_beneficiary_edit_notice(uuid) to service_role;

commit;
