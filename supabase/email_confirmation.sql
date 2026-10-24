-- Only people who have confirmed their email can create campaigns or challenges.
-- Run once in the Supabase SQL editor, after campaigns.sql and challenges.sql.
--
-- The app checks this too, and with "Confirm email" on, Supabase won't log in
-- unconfirmed users at all. This is the last line of defence, in the database.
--
-- Dashboard settings to go with it (Authentication):
--
-- 1. Sign In / Providers → Email: turn on "Confirm email". Set the minimum
--    password length to 8 and password requirements to "Letters and digits",
--    matching the rules in src/lib/validation.ts.
--
-- 2. URL Configuration: set Site URL to the live site, and add these Redirect URLs:
--      https://YOUR-DOMAIN/auth/callback**
--      http://localhost:3000/auth/callback**
--
-- 3. Emails → Templates: the default templates ({{ .ConfirmationURL }}) work.
--    Opened in a different browser, a confirm link still confirms the email
--    (the user is asked to log in), but a reset link asks for a new one.
--
-- 4. Later, once you have custom SMTP (Emails → SMTP Settings; Supabase only lets
--    you edit templates then), change the links so both work in any browser:
--      Confirm signup:  <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
--      Reset password:  <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Set a new password</a>
--    /auth/callback handles both kinds of link, so no code change is needed.

begin;

-- True when the logged-in user has confirmed their email. Runs with elevated
-- rights because logged-in users can't read auth.users themselves.
create or replace function public.email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
     where id = auth.uid() and email_confirmed_at is not null
  );
$$;

revoke execute on function public.email_confirmed() from public, anon;
grant execute on function public.email_confirmed() to authenticated;

alter policy "Organisers create their own campaigns"
  on public.campaigns
  with check (organiser_id = (select auth.uid()) and (select public.email_confirmed()));

alter policy "Users host their own challenges"
  on public.challenges
  with check (host_id = (select auth.uid()) and (select public.email_confirmed()));

commit;
