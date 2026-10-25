-- Viral campaigns in any category, and the Talent category.
-- Run once in the Supabase SQL editor, after minor_beneficiaries.sql.
--
-- - "This person went viral" is no longer limited to Business & Empowerment.
--   The video link rules and beneficiary confirmation stay the same.
-- - New category: Talent. It posts progress updates like every category
--   except Medical (see update_types_by_category.sql).

begin;

alter table public.campaigns drop constraint campaigns_viral_category_check;

-- Keep in sync with src/lib/categories.ts.
alter table public.campaigns drop constraint campaigns_category_check;
alter table public.campaigns
  add constraint campaigns_category_check check (category in (
    'Medical', 'Education', 'School Fees', 'Funeral', 'Wedding', 'Emergency', 'Community',
    'Church & Faith', 'Business & Empowerment', 'Farming', 'Housing', 'Sports & Youth',
    'Talent', 'Elder Care', 'Other'));

commit;
