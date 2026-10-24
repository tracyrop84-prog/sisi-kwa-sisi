-- Phase 2: mock donations. Run once in the Supabase SQL editor, after campaigns.sql.
-- Payments are MOCK: no money moves. A donation row is simply recorded.

create table public.donations (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  -- null means the donor chose to give anonymously; the name is never stored.
  donor_name   text check (donor_name is null or char_length(donor_name) between 1 and 60),
  amount       integer not null check (amount between 10 and 250000),  -- KES, M-Pesa per-transaction limit
  message      text check (message is null or char_length(message) <= 280),
  created_at   timestamptz not null default now()
);

create index donations_campaign_id_created_at_idx
  on public.donations (campaign_id, created_at desc);

-- Row-level security ---------------------------------------------------------

alter table public.donations enable row level security;

-- Anyone can see the donor list.
create policy "Donations are public"
  on public.donations for select
  to anon, authenticated
  using (true);

-- Anyone can give, logged in or not. Donations can't be edited or deleted.
create policy "Anyone can donate"
  on public.donations for insert
  to anon, authenticated
  with check (true);

revoke insert, update, delete on public.donations from anon, authenticated;
grant insert (campaign_id, donor_name, amount, message) on public.donations to anon, authenticated;

-- Campaign totals ------------------------------------------------------------
-- Organisers can't write campaigns.raised or donor_count (see campaigns.sql),
-- so this trigger updates them with elevated rights whenever a donation lands.

create function public.add_donation_to_campaign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.campaigns
     set raised = raised + new.amount,
         donor_count = donor_count + 1
   where id = new.campaign_id;
  return new;
end;
$$;

create trigger donations_update_campaign_totals
  after insert on public.donations
  for each row execute function public.add_donation_to_campaign();

-- Realtime -------------------------------------------------------------------
-- Lets open campaign pages refresh the moment someone donates.

alter publication supabase_realtime add table public.donations;
