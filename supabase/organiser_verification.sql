-- Phase 6 step 1: organiser verification.
-- Run once in the Supabase SQL editor, after complete_campaign.sql.
--
-- - Phone verification: organisers verify a Kenyan number (+2547… or +2541…)
--   with a 6-digit code before they can publish. Codes are bcrypt-hashed,
--   expire after 10 minutes, allow 5 attempts and can be resent once a minute.
--   Only the server (with the secret key) can issue a code, so nobody can get
--   one without it going by SMS. One verified number per account.
-- - Limits on new campaigns: a verified phone is required; organisers without
--   a completed or documents-checked campaign are capped at KES 100,000; goals
--   over KES 500,000 wait for admin approval (status 'pending').
-- - campaigns.status gains 'pending' (waiting for approval) and
--   'changes_requested' (an admin asked for changes, with a reason; the
--   organiser edits and resubmits). Neither is public or takes donations.
--   Pending counts toward the 2-campaign limit, changes_requested doesn't.
-- - The goal can't be changed after creating a campaign (goal_edits.sql then
--   allows it while changes are requested).
-- - Supporting documents: up to 5 images or PDFs of 5 MB each per campaign, in
--   the private campaign-documents bucket. Only the organiser and admins can
--   read them. Admins mark a campaign "Documents checked", which locks them.
-- - Edit history: once a campaign has a donation, every change to its title,
--   story or location is recorded. Only admins can read it; the campaign page
--   shows "Edited" from campaigns.last_edited_at.

begin;

-- Phone verification ----------------------------------------------------------

-- Verified numbers. Each number belongs to one account.
create table public.organiser_phones (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  phone       text not null unique
              constraint organiser_phones_phone_check check (phone ~ '^\+254[17][0-9]{8}$'),
  verified_at timestamptz not null default now()
);

alter table public.organiser_phones enable row level security;

-- Private: only the organiser and admins.
create policy "Organisers and admins read verified phones"
  on public.organiser_phones for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Only changes through verify_phone_code below.
revoke all on public.organiser_phones from anon, authenticated;
grant select on public.organiser_phones to authenticated;

-- The code waiting to be entered, one per user. No policies or grants: the app
-- can never read it, only the functions below.
create table public.phone_verifications (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  phone      text not null check (phone ~ '^\+254[17][0-9]{8}$'),
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   integer not null default 0,
  sent_at    timestamptz not null
);

alter table public.phone_verifications enable row level security;
revoke all on public.phone_verifications from anon, authenticated;

-- Creates a new code for this user and number and returns it, so the server
-- can send it by SMS. Only the secret key (service_role) can call this, never
-- the browser: otherwise anyone could get their code without the SMS.
-- The server passes the logged-in user's id.
create function public.issue_phone_code(p_user_id uuid, p_phone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bytes bytea := extensions.gen_random_bytes(4);
  v_code  text;
begin
  if p_phone is null or p_phone !~ '^\+254[17][0-9]{8}$' then
    raise exception 'invalid_phone';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id and email_confirmed_at is not null) then
    raise exception 'email_not_confirmed';
  end if;
  if exists (select 1 from public.organiser_phones where user_id = p_user_id and phone = p_phone) then
    raise exception 'already_verified';
  end if;
  if exists (select 1 from public.organiser_phones where phone = p_phone and user_id <> p_user_id) then
    raise exception 'phone_taken';
  end if;

  -- A random number from 0 to 999999 (4 random bytes, so the bias is tiny).
  v_code := lpad((
    (get_byte(v_bytes, 0)::bigint * 16777216
      + get_byte(v_bytes, 1) * 65536
      + get_byte(v_bytes, 2) * 256
      + get_byte(v_bytes, 3)) % 1000000
  )::text, 6, '0');

  -- Replaces any earlier code, unless one was sent less than a minute ago.
  -- One statement, so two requests at once can't both send.
  insert into public.phone_verifications as v (user_id, phone, code_hash, expires_at, attempts, sent_at)
  values (p_user_id, p_phone, extensions.crypt(v_code, extensions.gen_salt('bf')), now() + interval '10 minutes', 0, now())
  on conflict (user_id) do update
    set phone      = excluded.phone,
        code_hash  = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts   = 0,
        sent_at    = excluded.sent_at
    where v.sent_at <= now() - interval '1 minute';
  if not found then
    raise exception 'resend_too_soon';
  end if;
  return v_code;
end;
$$;

revoke execute on function public.issue_phone_code(uuid, text) from public, anon, authenticated;
grant execute on function public.issue_phone_code(uuid, text) to service_role;

-- Checks the code the logged-in user entered. Returns a result instead of
-- raising, so a wrong attempt is still counted (an exception would undo it):
-- 'verified', 'wrong_code', 'too_many_attempts', 'expired', 'no_code' or 'phone_taken'.
create function public.verify_phone_code(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.phone_verifications;
begin
  if auth.uid() is null or not public.email_confirmed() then
    raise exception 'not_logged_in';
  end if;

  select * into v from public.phone_verifications where user_id = auth.uid() for update;
  if not found then
    return 'no_code';
  end if;
  if v.expires_at < now() then
    return 'expired';
  end if;
  if v.attempts >= 5 then
    return 'too_many_attempts';
  end if;

  update public.phone_verifications set attempts = attempts + 1 where user_id = v.user_id;
  if p_code is null or p_code !~ '^[0-9]{6}$' or extensions.crypt(p_code, v.code_hash) <> v.code_hash then
    return case when v.attempts + 1 >= 5 then 'too_many_attempts' else 'wrong_code' end;
  end if;

  begin
    insert into public.organiser_phones (user_id, phone, verified_at)
    values (v.user_id, v.phone, now())
    on conflict (user_id) do update set phone = excluded.phone, verified_at = excluded.verified_at;
  exception when unique_violation then
    -- Another account verified this number in the meantime.
    delete from public.phone_verifications where user_id = v.user_id;
    return 'phone_taken';
  end;
  delete from public.phone_verifications where user_id = v.user_id;
  return 'verified';
end;
$$;

revoke execute on function public.verify_phone_code(text) from public, anon;
grant execute on function public.verify_phone_code(text) to authenticated;

-- Campaign status -------------------------------------------------------------

alter table public.campaigns drop constraint campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check
    check (status in ('active', 'paused', 'closed', 'completed', 'pending', 'changes_requested'));

-- None of these are in the column grants, so organisers can't set them.
alter table public.campaigns
  add column approved_at timestamptz,
  add column changes_requested_reason text
    constraint campaigns_changes_requested_reason_check
    check (changes_requested_reason is null or char_length(changes_requested_reason) between 1 and 1000),
  add column changes_requested_at timestamptz,
  add column documents_checked_at timestamptz,
  add column documents_checked_by uuid references auth.users (id) on delete set null,
  add column last_edited_at timestamptz;

-- Campaigns waiting for approval, or for the organiser's changes, aren't public.
alter policy "Campaigns are public"
  on public.campaigns
  using (status not in ('pending', 'changes_requested'));

-- Separate policy because anon can't call is_admin(). Policies add up, so
-- organisers and admins see those campaigns as well as the public ones.
create policy "Organisers and admins see unpublished campaigns"
  on public.campaigns for select
  to authenticated
  using (organiser_id = (select auth.uid()) or (select public.is_admin()));

-- Organisers can also edit while waiting for approval or making changes.
alter policy "Organisers update their own campaigns"
  on public.campaigns
  using (organiser_id = (select auth.uid()) and status in ('active', 'pending', 'changes_requested'))
  with check (organiser_id = (select auth.uid()) and status in ('active', 'pending', 'changes_requested'));

alter policy "Organisers delete their own campaigns"
  on public.campaigns
  using (organiser_id = (select auth.uid()) and status in ('active', 'pending', 'changes_requested'));

-- The goal is fixed once the campaign exists, so an approved or capped goal
-- can't be raised afterwards.
revoke update (goal) on public.campaigns from authenticated;

-- Same as in complete_campaign.sql, plus campaigns that aren't live yet.
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
  if v_status in ('pending', 'changes_requested') then
    raise exception 'campaign_not_live';
  end if;
  return new;
end;
$$;

-- Same as in complete_campaign.sql, except only an active campaign can be
-- completed. Before, a pending one could have skipped approval this way.
create or replace function public.complete_campaign(p_campaign_id uuid)
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
  if v_status = 'paused' then
    raise exception 'campaign_paused';
  end if;
  if v_status = 'closed' then
    raise exception 'campaign_closed';
  end if;
  if v_status = 'completed' then
    raise exception 'campaign_completed';
  end if;
  if v_status <> 'active' then
    raise exception 'campaign_not_live';
  end if;

  update public.campaigns set status = 'completed', completed_at = now() where id = p_campaign_id;

  -- Live challenges, and Mgeni Rasmi still waiting for the host, end now.
  update public.challenges c
     set ends_at = now()
   where c.campaign_id = p_campaign_id and public.challenge_is_active(c);
  -- Challenges still waiting for approval can never run now.
  update public.challenges
     set status = 'declined'
   where campaign_id = p_campaign_id and status = 'pending';
end;
$$;

-- Same as in reports.sql, plus campaigns that aren't live yet.
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
  if v_status in ('pending', 'changes_requested') then
    raise exception 'campaign_not_found';
  end if;
  return new;
end;
$$;

-- Limits on new campaigns ------------------------------------------------------

-- An organiser who has finished a harambee, or had one's documents checked
-- (and not closed for fraud), can set goals above KES 100,000. Public
-- information anyway, so the new-campaign page can call it too.
create function public.organiser_is_trusted(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns
     where organiser_id = p_user_id
       and (status = 'completed' or (documents_checked_at is not null and status <> 'closed'))
  );
$$;

revoke execute on function public.organiser_is_trusted(uuid) from public, anon;
grant execute on function public.organiser_is_trusted(uuid) to authenticated;

-- Same as in reports.sql, plus: a verified phone, the goal cap, approval for
-- big goals, and pending campaigns count toward the limit. Now runs with
-- elevated rights so it can see every campaign (some aren't public any more).
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
     where organiser_id = new.organiser_id and status in ('active', 'paused', 'pending')
  ) >= 2 then
    raise exception 'campaign_limit';
  end if;

  new.status := case when new.goal > 500000 then 'pending' else 'active' end;

  -- The app picks a free slug, but can't see other organisers' unpublished
  -- campaigns, so make sure here.
  while exists (select 1 from public.campaigns where slug = new.slug) loop
    new.slug := v_base || '-' || v_n;
    v_n := v_n + 1;
  end loop;
  return new;
end;
$$;

revoke execute on function public.prepare_new_campaign() from public, anon, authenticated;

-- Approval --------------------------------------------------------------------

-- Called from /admin: supabase.rpc('admin_approve_campaign', ...).
create function public.admin_approve_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.lock_campaign_for_review(p_campaign_id) <> 'pending' then
    raise exception 'not_pending';
  end if;
  update public.campaigns
     set status = 'active', approved_at = now(), changes_requested_reason = null, changes_requested_at = null
   where id = p_campaign_id;
end;
$$;

-- The organiser sees the reason on their campaign, edits and resubmits.
create function public.admin_request_changes(p_campaign_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if public.lock_campaign_for_review(p_campaign_id) <> 'pending' then
    raise exception 'not_pending';
  end if;
  if char_length(v_reason) not between 1 and 1000 then
    raise exception 'reason_required';
  end if;
  update public.campaigns
     set status = 'changes_requested', changes_requested_reason = v_reason, changes_requested_at = now()
   where id = p_campaign_id;
end;
$$;

-- Called from the campaign page. Back to pending; the admin still sees the
-- reason they gave until they approve.
create function public.resubmit_campaign(p_campaign_id uuid)
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
     where organiser_id = v_organiser_id and status in ('active', 'paused', 'pending')
  ) >= 2 then
    raise exception 'campaign_limit';
  end if;

  update public.campaigns set status = 'pending' where id = p_campaign_id;
end;
$$;

revoke execute on function public.admin_approve_campaign(uuid) from public, anon;
revoke execute on function public.admin_request_changes(uuid, text) from public, anon;
revoke execute on function public.resubmit_campaign(uuid) from public, anon;
grant execute on function public.admin_approve_campaign(uuid) to authenticated;
grant execute on function public.admin_request_changes(uuid, text) to authenticated;
grant execute on function public.resubmit_campaign(uuid) to authenticated;

-- Supporting documents --------------------------------------------------------
-- Stored in the bucket as {campaign id}/{document id}.{pdf|jpg|png|webp}. The
-- row comes first and the upload must match it, so the 5-file limit holds.

create table public.campaign_documents (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  file_name    text not null check (char_length(file_name) between 1 and 200),
  -- Keep in sync with DOCUMENT_TYPES in src/lib/documents.ts.
  content_type text not null
               check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes   integer not null check (size_bytes between 1 and 5242880),
  path         text generated always as (
                 campaign_id::text || '/' || id::text || case content_type
                   when 'application/pdf' then '.pdf'
                   when 'image/jpeg'      then '.jpg'
                   when 'image/png'       then '.png'
                   else '.webp'
                 end
               ) stored unique,
  created_at   timestamptz not null default now()
);

create index campaign_documents_campaign_id_idx on public.campaign_documents (campaign_id, created_at);

-- True when the logged-in user can add or remove documents on this campaign:
-- they organise it, it isn't closed, and its documents haven't been checked.
-- Takes text because Storage passes folder names as text.
create function public.documents_open(p_campaign_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_campaign_organiser(p_campaign_id) then
      exists (select 1 from public.campaigns where id = p_campaign_id::uuid and documents_checked_at is null)
    else false
  end;
$$;

revoke execute on function public.documents_open(text) from public, anon;
grant execute on function public.documents_open(text) to authenticated;

alter table public.campaign_documents enable row level security;

-- Never public: only the organiser and admins.
create policy "Organisers and admins read documents"
  on public.campaign_documents for select
  to authenticated
  using ((select public.is_campaign_organiser(campaign_id::text)) or (select public.is_admin()));

create policy "Organisers add documents"
  on public.campaign_documents for insert
  to authenticated
  with check ((select public.documents_open(campaign_id::text)));

create policy "Organisers remove documents"
  on public.campaign_documents for delete
  to authenticated
  using ((select public.documents_open(campaign_id::text)));

revoke insert, update, delete on public.campaign_documents from anon, authenticated;
grant insert (campaign_id, file_name, content_type, size_bytes) on public.campaign_documents to authenticated;
grant delete on public.campaign_documents to authenticated;

-- At most 5 per campaign. The lock makes two uploads at once take turns.
create function public.prepare_new_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  perform 1 from public.campaigns where id = new.campaign_id for update;
  if (select count(*) from public.campaign_documents where campaign_id = new.campaign_id) >= 5 then
    raise exception 'document_limit';
  end if;
  return new;
end;
$$;

create trigger campaign_documents_prepare_new
  before insert on public.campaign_documents
  for each row execute function public.prepare_new_document();

revoke execute on function public.prepare_new_document() from public, anon, authenticated;

-- True when this Storage path belongs to a document row the logged-in user
-- can still change.
create function public.document_upload_allowed(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_documents d
     where d.path = p_path and public.documents_open(d.campaign_id::text)
  );
$$;

revoke execute on function public.document_upload_allowed(text) from public, anon;
grant execute on function public.document_upload_allowed(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-documents', 'campaign-documents', false, 5242880,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Organisers and admins read campaign documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'campaign-documents'
    and (
      (select public.is_campaign_organiser((storage.foldername(name))[1]))
      or (select public.is_admin())
    )
  );

-- No update policy, so an uploaded document can't be replaced.
create policy "Organisers upload campaign documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'campaign-documents' and (select public.document_upload_allowed(name)));

-- The app removes the file first, then the row.
create policy "Organisers delete campaign documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'campaign-documents' and (select public.document_upload_allowed(name)));

-- Called from /admin: supabase.rpc('admin_mark_documents_checked', ...).
-- Shows the badge, locks the documents, and lets the organiser set goals
-- above KES 100,000 on future campaigns.
create function public.admin_mark_documents_checked(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_campaign_for_review(p_campaign_id);
  if not exists (select 1 from public.campaign_documents where campaign_id = p_campaign_id) then
    raise exception 'no_documents';
  end if;
  update public.campaigns
     set documents_checked_at = now(), documents_checked_by = auth.uid()
   where id = p_campaign_id and documents_checked_at is null;
end;
$$;

revoke execute on function public.admin_mark_documents_checked(uuid) from public, anon;
grant execute on function public.admin_mark_documents_checked(uuid) to authenticated;

-- Edit history ----------------------------------------------------------------

create table public.campaign_edits (
  id          bigint generated always as identity primary key,
  -- Like reports, the record stays: a campaign with edits can't be deleted.
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  field       text not null check (field in ('title', 'story', 'location')),
  old_value   text not null,
  new_value   text not null,
  edited_by   uuid references auth.users (id) on delete set null,
  edited_at   timestamptz not null default now()
);

create index campaign_edits_campaign_id_edited_at_idx on public.campaign_edits (campaign_id, edited_at desc);

alter table public.campaign_edits enable row level security;

create policy "Admins read edit history"
  on public.campaign_edits for select
  to authenticated
  using ((select public.is_admin()));

-- Only written by the trigger below.
revoke all on public.campaign_edits from anon, authenticated;
grant select on public.campaign_edits to authenticated;

-- After the first donation, records each changed field and stamps
-- last_edited_at. OLD is the row as locked for this update, so a donation
-- landing at the same moment is always counted.
create function public.record_campaign_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.donor_count = 0 then
    return new;
  end if;
  if new.title is distinct from old.title then
    insert into public.campaign_edits (campaign_id, field, old_value, new_value, edited_by)
    values (new.id, 'title', old.title, new.title, auth.uid());
  end if;
  if new.story is distinct from old.story then
    insert into public.campaign_edits (campaign_id, field, old_value, new_value, edited_by)
    values (new.id, 'story', old.story, new.story, auth.uid());
  end if;
  if new.location is distinct from old.location then
    insert into public.campaign_edits (campaign_id, field, old_value, new_value, edited_by)
    values (new.id, 'location', old.location, new.location, auth.uid());
  end if;
  new.last_edited_at := now();
  return new;
end;
$$;

create trigger campaigns_record_edit
  before update of title, story, location on public.campaigns
  for each row
  when (old.title is distinct from new.title
     or old.story is distinct from new.story
     or old.location is distinct from new.location)
  execute function public.record_campaign_edit();

revoke execute on function public.record_campaign_edit() from public, anon, authenticated;

commit;
