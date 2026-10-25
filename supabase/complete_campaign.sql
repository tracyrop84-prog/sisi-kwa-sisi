-- Completing a campaign ("Close harambee"). Run once in the Supabase SQL editor, after reports.sql.
--
-- - campaigns.status gains 'completed': the organiser ended it. Separate from
--   'closed', which means an admin confirmed fraud.
-- - Only the organiser can complete their own campaign, and only while it's
--   active, so a paused campaign can't dodge its review. It can't be undone.
-- - Completed campaigns take no donations or new challenges, and their live
--   challenges end. Organisers can still post updates but not edit details
--   (both already follow from reports.sql, which only allows edits while active
--   and only blocks updates once closed).
-- - They don't count toward the 2-campaign limit (reports.sql only counts
--   active and paused ones).
-- - They can still be reported, and an admin can still confirm fraud on them.

begin;

alter table public.campaigns drop constraint campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check check (status in ('active', 'paused', 'closed', 'completed'));

alter table public.campaigns add column completed_at timestamptz;

-- Same as in reports.sql, plus completed campaigns.
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
  return new;
end;
$$;

-- Same as in reports.sql, except clearing only resumes a paused campaign.
-- Before, clearing reports on a completed campaign would have reopened it.
create or replace function public.admin_clear_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_campaign_for_review(p_campaign_id);
  update public.campaigns
     set status = 'active', paused_at = null
   where id = p_campaign_id and status = 'paused';
  update public.reports
     set status = 'resolved', resolution = 'cleared', resolved_by = auth.uid(), resolved_at = now()
   where campaign_id = p_campaign_id and status = 'open';
end;
$$;

-- Called from the campaign page: supabase.rpc('complete_campaign', ...).
create function public.complete_campaign(p_campaign_id uuid)
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

revoke execute on function public.complete_campaign(uuid) from public, anon;
grant execute on function public.complete_campaign(uuid) to authenticated;

commit;
