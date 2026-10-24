-- Campaigns table for Sisi kwa Sisi.
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null check (char_length(title) between 5 and 100),
  category     text not null check (category in ('Medical', 'Education', 'Funeral', 'Emergency', 'Community', 'Other')),
  organiser    text not null,  -- display name shown on the page
  beneficiary  text not null,
  location     text not null,
  goal         integer not null check (goal between 1000 and 50000000),  -- KES
  raised       integer not null default 0 check (raised >= 0),           -- KES
  donor_count  integer not null default 0 check (donor_count >= 0),
  story        text not null,
  -- The logged-in user who owns the campaign. Seeded sample rows have no owner.
  organiser_id uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

create index campaigns_created_at_idx on public.campaigns (created_at desc);
create index campaigns_organiser_id_idx on public.campaigns (organiser_id);

-- Row-level security ---------------------------------------------------------

alter table public.campaigns enable row level security;

-- Anyone, logged in or not, can read campaigns.
create policy "Campaigns are public"
  on public.campaigns for select
  to anon, authenticated
  using (true);

-- Logged-in users can create campaigns, but only as themselves.
create policy "Organisers create their own campaigns"
  on public.campaigns for insert
  to authenticated
  with check (organiser_id = (select auth.uid()));

-- Organisers can edit only their own campaigns.
create policy "Organisers update their own campaigns"
  on public.campaigns for update
  to authenticated
  using (organiser_id = (select auth.uid()))
  with check (organiser_id = (select auth.uid()));

-- Organisers can delete only their own campaigns.
create policy "Organisers delete their own campaigns"
  on public.campaigns for delete
  to authenticated
  using (organiser_id = (select auth.uid()));

-- Column permissions ---------------------------------------------------------
-- RLS decides which rows a user can touch; these grants decide which columns.
-- Organisers must not be able to set raised or donor_count themselves; those
-- will only change through donations (server-side) in Phase 2.

revoke insert, update on public.campaigns from anon, authenticated;

grant insert (slug, title, category, organiser, beneficiary, location, goal, story, organiser_id)
  on public.campaigns to authenticated;

grant update (title, category, organiser, beneficiary, location, goal, story)
  on public.campaigns to authenticated;
