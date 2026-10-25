-- Phase 6 step 2b: beneficiaries under 18.
-- Run once in the Supabase SQL editor, after beneficiary_verification.sql.
--
-- - "The beneficiary is under 18" is chosen when creating and never changes.
-- - The confirmation SMS goes to a parent or guardian (name, relationship and
--   phone), whose number becomes the payout number. The organiser may be that
--   parent or guardian, so their own number is allowed here.
-- - The organiser must accept the photo consent, stored word for word like
--   the declaration.
-- - After the guardian confirms, the campaign always waits for admin
--   approval, whatever the goal. A check makes sure it can't be live without it.
-- - The guardian's name stays private: the badge only says a guardian confirmed.

begin;

-- Campaigns -------------------------------------------------------------------

alter table public.campaigns
  add column beneficiary_is_minor boolean not null default false,
  add column minor_photo_consent text
    constraint campaigns_minor_photo_consent_check
    check (minor_photo_consent is null or char_length(minor_photo_consent) between 1 and 500),
  add column minor_photo_consent_at timestamptz,
  add constraint campaigns_minor_photo_consent_accepted
    check ((minor_photo_consent is null) = (minor_photo_consent_at is null)),
  add constraint campaigns_minor_needs_confirmation
    check (not beneficiary_is_minor or (beneficiary_confirmation and minor_photo_consent is not null)),
  -- Never live (or paused or completed, which come after live) without an
  -- admin's approval. Closed is allowed: the guardian can decline first.
  add constraint campaigns_minor_needs_approval
    check (not beneficiary_is_minor or approved_at is not null
           or status in ('awaiting_beneficiary', 'pending', 'changes_requested', 'closed'));

grant insert (beneficiary_is_minor, minor_photo_consent) on public.campaigns to authenticated;

-- Runs before campaigns_prepare_new (triggers run in name order), so that one
-- sees beneficiary_confirmation already set and waits for the guardian.
create function public.prepare_minor_campaign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.beneficiary_is_minor then
    new.minor_photo_consent := null;
  elsif new.minor_photo_consent is null then
    raise exception 'minor_consent_required';
  else
    new.beneficiary_confirmation := true;
  end if;
  new.minor_photo_consent_at := case when new.minor_photo_consent is null then null else now() end;
  return new;
end;
$$;

create trigger campaigns_prepare_minor
  before insert on public.campaigns
  for each row execute function public.prepare_minor_campaign();

revoke execute on function public.prepare_minor_campaign() from public, anon, authenticated;

-- Guardian details --------------------------------------------------------------

-- How the guardian is related to the child, e.g. "Mother". Only for under-18s.
alter table public.beneficiary_verifications
  add column relationship text
    constraint beneficiary_verifications_relationship_check
    check (relationship is null or char_length(relationship) between 2 and 50);

alter table public.payout_phones
  add column relationship text;

-- Same as in beneficiary_verification.sql, plus p_minor: a parent may organise
-- for their own child, so their own number is allowed then.
drop function public.check_beneficiary_phone(uuid, text, boolean);

create function public.check_beneficiary_phone(p_user_id uuid, p_phone text, p_viral boolean, p_minor boolean)
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
  -- The organiser can't confirm their own harambee, unless it's for their child.
  if not p_minor and exists (select 1 from public.organiser_phones where user_id = p_user_id and phone = p_phone) then
    raise exception 'own_phone';
  end if;
  if p_viral and public.viral_phone_in_use(p_phone, '00000000-0000-0000-0000-000000000000') then
    raise exception 'beneficiary_has_viral_campaign';
  end if;
end;
$$;

revoke execute on function public.check_beneficiary_phone(uuid, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.check_beneficiary_phone(uuid, text, boolean, boolean) to service_role;

-- Same as in beneficiary_verification.sql, plus the guardian's relationship,
-- required for under-18s and ignored otherwise.
drop function public.issue_beneficiary_link(uuid, uuid, text, text);

create function public.issue_beneficiary_link(
  p_user_id uuid, p_campaign_id uuid, p_name text, p_phone text, p_relationship text
)
returns table (token text, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name         text := btrim(coalesce(p_name, ''));
  v_relationship text := nullif(btrim(coalesce(p_relationship, '')), '');
  v_token        text := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_code         text := public.random_phone_code();
  v_c            public.campaigns;
  v_sent         timestamptz;
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
  if not v_c.beneficiary_is_minor then
    v_relationship := null;
  elsif v_relationship is null or char_length(v_relationship) not between 2 and 50 then
    raise exception 'invalid_relationship';
  end if;
  perform public.check_beneficiary_phone(p_user_id, p_phone, v_c.viral_video_url is not null, v_c.beneficiary_is_minor);

  -- The campaign is locked, so two requests at once can't both send.
  select sent_at into v_sent from public.beneficiary_verifications where campaign_id = p_campaign_id;
  if v_sent > now() - interval '1 minute' then
    raise exception 'resend_too_soon';
  end if;

  insert into public.beneficiary_verifications as v
    (campaign_id, name, relationship, phone, token_hash, link_expires_at, code_hash, code_expires_at, attempts, sent_at)
  values
    (p_campaign_id, v_name, v_relationship, p_phone, public.token_hash(v_token), now() + interval '7 days',
     extensions.crypt(v_code, extensions.gen_salt('bf')), now() + interval '10 minutes', 0, now())
  on conflict (campaign_id) do update
    set name            = excluded.name,
        relationship    = excluded.relationship,
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

revoke execute on function public.issue_beneficiary_link(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.issue_beneficiary_link(uuid, uuid, text, text, text) to service_role;

-- Same as in beneficiary_verification.sql, plus the relationship.
drop function public.beneficiary_link_status(uuid);

create function public.beneficiary_link_status(p_campaign_id uuid)
returns table (name text, relationship text, phone text, sent_at timestamptz, link_expires_at timestamptz, outcome text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.name, v.relationship, v.phone, v.sent_at, v.link_expires_at, v.outcome
    from public.beneficiary_verifications v
   where v.campaign_id = p_campaign_id
     and (public.is_campaign_organiser(p_campaign_id::text) or public.is_admin());
$$;

revoke execute on function public.beneficiary_link_status(uuid) from public, anon;
grant execute on function public.beneficiary_link_status(uuid) to authenticated;

-- Same as in beneficiary_verification.sql, plus whether the beneficiary is a
-- child, the child's name and the guardian's relationship, for the /confirm page.
create or replace function public.beneficiary_check_code(p_token text, p_code text)
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
    'slug', v_c.slug,
    'minor', v_c.beneficiary_is_minor,
    'child', case when v_c.beneficiary_is_minor then v_c.beneficiary end,
    'relationship', v.relationship
  );
end;
$$;

-- Same as in beneficiary_verification.sql, except for under-18s: the organiser
-- may be the guardian, the campaign always goes to admin approval, and the
-- guardian's name isn't made public.
create or replace function public.beneficiary_confirm(p_token text, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link     text;
  v          public.beneficiary_verifications;
  v_result   text;
  v_c        public.campaigns;
  v_approval boolean;
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

  if not v_c.beneficiary_is_minor
     and exists (select 1 from public.organiser_phones where user_id = v_c.organiser_id and phone = v.phone) then
    return 'own_phone';
  end if;
  if v_c.viral_video_url is not null then
    -- Confirmations for the same number take turns, so two can't both pass.
    perform pg_advisory_xact_lock(hashtext('viral_phone:' || v.phone));
    if public.viral_phone_in_use(v.phone, v_c.id) then
      return 'beneficiary_has_viral_campaign';
    end if;
  end if;

  v_approval := v_c.beneficiary_is_minor or v_c.goal > 500000;
  insert into public.payout_phones (campaign_id, phone, name, relationship)
  values (v_c.id, v.phone, v.name, v.relationship);
  update public.beneficiary_verifications set outcome = 'confirmed', answered_at = now() where campaign_id = v_c.id;
  update public.campaigns
     set status = case when v_approval then 'pending' else 'active' end,
         beneficiary_confirmed_name = case when v_c.beneficiary_is_minor then null else v.name end,
         beneficiary_confirmed_at = now()
   where id = v_c.id;
  return case when v_approval then 'pending_approval' else 'live' end;
end;
$$;

commit;
