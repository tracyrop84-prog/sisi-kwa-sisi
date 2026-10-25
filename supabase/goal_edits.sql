-- Goal edits while changes are requested. Run once in the Supabase SQL editor,
-- after organiser_verification.sql.
--
-- - Organisers can change the goal only while an admin has requested changes,
--   e.g. "please lower your goal". Otherwise it stays fixed once created.
-- - The same cap as for new campaigns applies: KES 100,000 unless the
--   organiser has a completed or documents-checked campaign.
-- - Resubmitting always goes back to pending, so an admin sees the new goal
--   before it goes live.

begin;

-- organiser_verification.sql revoked this; the trigger below decides when.
grant update (goal) on public.campaigns to authenticated;

-- OLD is the row as locked for this update, so the status can't change
-- underneath (admin functions lock the campaign too).
create function public.check_goal_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;  -- the SQL editor
  end if;
  if old.status <> 'changes_requested' then
    raise exception 'goal_locked';
  end if;
  if new.goal > 100000 and not public.organiser_is_trusted(old.organiser_id) then
    raise exception 'goal_too_high';
  end if;
  return new;
end;
$$;

create trigger campaigns_check_goal_change
  before update of goal on public.campaigns
  for each row when (old.goal is distinct from new.goal)
  execute function public.check_goal_change();

revoke execute on function public.check_goal_change() from public, anon, authenticated;

commit;
