-- Deletes Tracy's test campaigns and the old sample campaigns from seed.sql.
-- Run it yourself in the Supabase SQL editor, after checking the list below.
--
-- Before running:
-- 1. supabase/demo_data.sql has been run (this file skips demo campaigns).
-- 2. Their photos and documents are removed first, because deleting files here
--    in SQL would leave the actual files behind in Storage:
--      node --env-file=.env.local scripts/tidy-test-photos.mjs         (lists them)
--      node --env-file=.env.local scripts/tidy-test-photos.mjs --yes   (removes them)
--
-- Deleting a campaign also deletes its donations, challenges, updates,
-- documents and beneficiary link. Campaigns with reports, edit history or a
-- payout number can't be deleted (the database keeps those records), so the
-- script stops and says which one if it finds any.

begin;

create temp table tidy on commit drop as
  select id, slug, title, status
    from public.campaigns
   where not is_demo
     and slug in (
       -- Test campaigns
       'ghhjdyhghh',
       'marys-wedding-fundraiser',
       'build-a-new-classroom-for-mwangaza-primary-school',
       'help-achieng-record-her-first-song',
       -- Sample campaigns from the old supabase/seed.sql
       'wanjiku-heart-surgery',
       'otieno-school-fees',
       'mzee-kiprono-send-off',
       'kibera-water-tank'
     );

do $$
declare
  v_slug text;
begin
  select t.slug into v_slug from tidy t join public.reports r on r.campaign_id = t.id limit 1;
  if found then
    raise exception '% has reports, so it can''t be deleted. Take it out of the list.', v_slug;
  end if;
  select t.slug into v_slug from tidy t join public.campaign_edits e on e.campaign_id = t.id limit 1;
  if found then
    raise exception '% has edit history, so it can''t be deleted. Take it out of the list.', v_slug;
  end if;
  select t.slug into v_slug from tidy t join public.payout_phones p on p.campaign_id = t.id limit 1;
  if found then
    raise exception '% has a confirmed payout number, so it can''t be deleted. Take it out of the list.', v_slug;
  end if;
end;
$$;

-- What's about to go (shown in the results panel).
select t.slug, t.title, t.status,
       (select count(*) from public.donations d where d.campaign_id = t.id) as donations,
       (select count(*) from public.challenges c where c.campaign_id = t.id) as challenges,
       (select count(*) from public.campaign_updates u where u.campaign_id = t.id) as updates
  from tidy t
 order by t.slug;

delete from public.campaigns where id in (select id from tidy);

commit;
