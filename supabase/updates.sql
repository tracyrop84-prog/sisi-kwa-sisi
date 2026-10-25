-- Phase 4: campaign updates feed and cover photos.
-- Run once in the Supabase SQL editor, after email_confirmation.sql.
--
-- - campaign_updates: gifts, recovery, progress and general news, newest first
-- - campaigns.cover_photo: an optional cover photo
-- - campaign-photos Storage bucket: anyone can view, only a campaign's
--   organiser can upload or delete that campaign's photos
--
-- Photos live in the bucket as {campaign id}/cover/{uuid}.jpg and
-- {campaign id}/updates/{uuid}.jpg. The tables store those paths.

begin;

-- True when the logged-in user organises this campaign and has confirmed
-- their email. Takes text because Storage passes folder names as text.
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
         where id = p_campaign_id::uuid and organiser_id = auth.uid()
      ) and public.email_confirmed()
    else false
  end;
$$;

revoke execute on function public.is_campaign_organiser(text) from public, anon;
grant execute on function public.is_campaign_organiser(text) to authenticated;

-- True when every path is a photo we generated inside the given folder,
-- e.g. '…campaign id…/updates/'.
create or replace function public.photos_in_folder(p_paths text[], p_folder text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(p ~ ('^' || p_folder || '[0-9a-f-]{36}\.jpg$')), true)
    from unnest(p_paths) as p;
$$;

-- Cover photo -----------------------------------------------------------------

alter table public.campaigns
  add column cover_photo text
  constraint campaigns_cover_photo_check
  check (cover_photo is null or public.photos_in_folder(array[cover_photo], id::text || '/cover/'));

-- Organisers set it after the campaign exists (the photo goes in its folder).
grant update (cover_photo) on public.campaigns to authenticated;

-- Updates ---------------------------------------------------------------------

create table public.campaign_updates (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references public.campaigns (id) on delete cascade,
  type             text not null check (type in ('gift', 'recovery', 'progress', 'general')),
  body             text check (body is null or char_length(body) between 1 and 2000),
  -- Gifts only. A null giver means "Anonymous". The value is an estimate in
  -- KES and never counts toward the cash raised.
  gift_item        text check (gift_item is null or char_length(gift_item) between 1 and 80),
  gift_giver       text check (gift_giver is null or char_length(gift_giver) between 1 and 60),
  gift_value       integer check (gift_value is null or gift_value between 1 and 50000000),
  -- Recovery updates only.
  recovery_status  text check (recovery_status is null
                               or recovery_status in ('in_hospital', 'recovering', 'back_home', 'fully_recovered')),
  photos           text[] not null default '{}' check (cardinality(photos) <= 5),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Text is optional for gifts and required for everything else.
  constraint campaign_updates_body_required check (type = 'gift' or body is not null),
  constraint campaign_updates_gift_fields check (
    case when type = 'gift' then gift_item is not null
         else gift_item is null and gift_giver is null and gift_value is null end
  ),
  constraint campaign_updates_recovery_status check (type = 'recovery' or recovery_status is null),
  constraint campaign_updates_photos_folder check (
    public.photos_in_folder(photos, campaign_id::text || '/updates/')
  )
);

create index campaign_updates_campaign_id_created_at_idx
  on public.campaign_updates (campaign_id, created_at desc);

-- Update types by category: recovery updates are only for Medical campaigns,
-- progress updates for every other category. Gift and general suit all.
-- Checked when an update is posted (the type can't change afterwards).
create function public.check_update_type_for_category()
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

create trigger campaign_updates_check_type
  before insert on public.campaign_updates
  for each row execute function public.check_update_type_for_category();

-- And a campaign's category can't change in a way that would break its updates.
create function public.check_category_change()
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

create trigger campaigns_check_category_change
  before update of category on public.campaigns
  for each row when (old.category is distinct from new.category)
  execute function public.check_category_change();

create function public.touch_campaign_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger campaign_updates_touch
  before update on public.campaign_updates
  for each row execute function public.touch_campaign_update();

alter table public.campaign_updates enable row level security;

create policy "Updates are public"
  on public.campaign_updates for select
  to anon, authenticated
  using (true);

create policy "Organisers post updates on their campaigns"
  on public.campaign_updates for insert
  to authenticated
  with check ((select public.is_campaign_organiser(campaign_id::text)));

create policy "Organisers edit updates on their campaigns"
  on public.campaign_updates for update
  to authenticated
  using ((select public.is_campaign_organiser(campaign_id::text)))
  with check ((select public.is_campaign_organiser(campaign_id::text)));

create policy "Organisers delete updates on their campaigns"
  on public.campaign_updates for delete
  to authenticated
  using ((select public.is_campaign_organiser(campaign_id::text)));

-- The type and campaign are fixed once posted.
revoke insert, update, delete on public.campaign_updates from anon, authenticated;
grant insert (campaign_id, type, body, gift_item, gift_giver, gift_value, recovery_status, photos)
  on public.campaign_updates to authenticated;
grant update (body, gift_item, gift_giver, gift_value, recovery_status, photos)
  on public.campaign_updates to authenticated;
grant delete on public.campaign_updates to authenticated;

-- Storage ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-photos', 'campaign-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can view. (Supabase also needs this to let organisers delete.)
create policy "Campaign photos are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'campaign-photos');

create policy "Organisers upload their campaign photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'campaign-photos'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] in ('cover', 'updates')
    and (select public.is_campaign_organiser((storage.foldername(name))[1]))
  );

create policy "Organisers delete their campaign photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'campaign-photos'
    and (select public.is_campaign_organiser((storage.foldername(name))[1]))
  );

commit;
