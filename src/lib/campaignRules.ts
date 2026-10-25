// Checks shared by the create and edit campaign forms. The edit form runs them
// in the browser too, before uploading a new cover photo.

export type DetailField = "title" | "beneficiary" | "location" | "story";

export function campaignDetailErrors(v: Record<DetailField, string>): Partial<Record<DetailField, string>> {
  const errors: Partial<Record<DetailField, string>> = {};
  if (v.title.length < 5) errors.title = "Give your harambee a title (at least 5 characters).";
  if (v.title.length > 100) errors.title = "Keep the title under 100 characters.";
  if (!v.beneficiary) errors.beneficiary = "Tell people who the money is for.";
  if (!v.location) errors.location = "Add a town or county.";
  if (v.story.length < 30) errors.story = "Share a bit more of the story (at least 30 characters).";
  return errors;
}

// Matches the goal check in supabase/campaigns.sql.
export const MIN_GOAL = 1000;
export const MAX_GOAL = 50_000_000;

// Shared by the create form and the edit form (while changes are requested).
// maxGoal is NEW_ORGANISER_MAX_GOAL for organisers who are still capped.
export function goalError(goal: number, maxGoal: number | null = null): string | undefined {
  if (!Number.isInteger(goal) || goal < MIN_GOAL || goal > MAX_GOAL) {
    return `Enter a whole amount between KES ${MIN_GOAL.toLocaleString("en-KE")} and KES ${MAX_GOAL.toLocaleString("en-KE")}.`;
  }
  if (maxGoal !== null && goal > maxGoal) return goalCapMessage(maxGoal);
}

export function goalCapMessage(maxGoal: number): string {
  return `Your first harambee can have a goal of up to KES ${maxGoal.toLocaleString("en-KE")}.`;
}

// Organiser safeguards, enforced in supabase/reports.sql.

// Stored word for word with each new campaign, so changing it only affects new ones.
export const CAMPAIGN_DECLARATION =
  "I confirm this information is true and the money will be used as described. False campaigns may be reported to the authorities.";

// Active and paused campaigns both count.
export const MAX_OPEN_CAMPAIGNS = 2;

// Organiser verification, enforced in supabase/organiser_verification.sql.

// Organisers without a completed or documents-checked harambee can't ask for more.
export const NEW_ORGANISER_MAX_GOAL = 100_000;

// Goals above this wait for admin approval before going live.
export const APPROVAL_GOAL = 500_000;

// What an admin writes when requesting changes; the database allows up to this.
export const MAX_CHANGES_REASON = 1000;
