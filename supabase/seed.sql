-- Sample campaigns from the Phase 1 sample data (the old data/campaigns.json).
-- Run in the Supabase SQL editor after campaigns.sql has created the table.
-- organiser_id is left empty, so nobody can edit these rows from the app.
-- Safe to run more than once: rows whose slug already exists are skipped.

insert into public.campaigns
  (slug, title, category, organiser, beneficiary, location, goal, raised, donor_count, story, organiser_id, created_at)
values
  ('wanjiku-heart-surgery', 'Help Wanjiku get heart surgery', 'Medical', 'Grace Muthoni', 'Wanjiku Kamau', 'Nyeri',
   850000, 512300, 214,
   E'Wanjiku is 9 years old and needs open-heart surgery at Kenyatta National Hospital. Her family has sold what they can, but the cost is still far beyond reach.\n\nEvery shilling brings her closer to the operating table. Asante kwa moyo wako.',
   null, '2026-10-02T09:00:00Z'),
  ('otieno-school-fees', 'Otieno''s Form 3 school fees', 'Education', 'Mary Akinyi', 'Brian Otieno', 'Kisumu',
   65000, 48500, 37,
   'Brian is top of his class at Maseno School but risks being sent home this term over unpaid fees. Help us keep him in school.',
   null, '2026-10-10T12:30:00Z'),
  ('mzee-kiprono-send-off', 'Send-off for Mzee Kiprono', 'Funeral', 'Kiprono Family', 'The Kiprono family', 'Eldoret',
   300000, 301200, 156,
   'Our father, Mzee Joseph Kiprono, rested on 14 October. We are raising funds to give him a dignified send-off in Kapsabet. Thank you for standing with us.',
   null, '2026-10-15T07:45:00Z'),
  ('kibera-water-tank', 'Clean water tank for Kibera youth group', 'Community', 'Amani Youth Group', 'Amani Youth Group', 'Nairobi',
   180000, 21000, 18,
   'A 10,000-litre tank will give 60 households clean water and fund the group''s car-wash business.',
   null, '2026-10-20T15:10:00Z')
on conflict (slug) do nothing;
