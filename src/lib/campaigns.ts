import "server-only";
import type { Category } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";

// Campaigns live in the Supabase "campaigns" table (see supabase/campaigns.sql).
// Everything that reads or writes campaigns goes through this file.

export { CATEGORIES, type Category } from "@/lib/categories";

// active: taking donations. paused: under review, no donations (see
// supabase/reports.sql). closed: fraud confirmed, permanently. completed: the
// organiser ended it, permanently (see supabase/complete_campaign.sql).
// pending: waiting for admin approval. changes_requested: an admin asked the
// organiser for changes. Only the organiser and admins can see those two (see
// supabase/organiser_verification.sql). awaiting_beneficiary: waiting for the
// beneficiary to confirm by SMS, also private, with the details locked (see
// supabase/beneficiary_verification.sql).
export type CampaignStatus =
  | "active"
  | "paused"
  | "closed"
  | "completed"
  | "pending"
  | "changes_requested"
  | "awaiting_beneficiary";

// Not public yet: only the organiser and admins can open these.
export const UNPUBLISHED_STATUSES: CampaignStatus[] = ["pending", "changes_requested", "awaiting_beneficiary"];

// Organisers can edit the details while the campaign is live or not yet approved.
export function canEditDetails(status: CampaignStatus): boolean {
  return status === "active" || status === "pending" || status === "changes_requested";
}

export type Campaign = {
  id: string;
  slug: string;
  title: string;
  category: Category;
  organiser: string;
  beneficiary: string;
  location: string;
  goal: number;
  raised: number;
  donorCount: number;
  story: string;
  organiserId: string | null; // null for seeded sample campaigns
  coverPhoto: string | null; // Storage path, see src/lib/photos.ts
  status: CampaignStatus;
  pausedAt: string | null;
  closedAt: string | null;
  completedAt: string | null;
  changesRequestedReason: string | null; // shown to the organiser
  documentsCheckedAt: string | null; // shows the "Documents checked" badge
  lastEditedAt: string | null; // title, story or location changed after the first donation
  viralVideoUrl: string | null; // Business & Empowerment only, see src/lib/videoLinks.ts
  beneficiaryConfirmation: boolean; // waits for, or got, the beneficiary's confirmation
  beneficiaryConfirmedName: string | null; // shows the "Verified" badge
  beneficiaryConfirmedAt: string | null;
  beneficiaryDeclinedAt: string | null; // the beneficiary said no, which closed it
  createdAt: string;
};

const COLUMNS =
  "id, slug, title, category, organiser, beneficiary, location, goal, raised, donor_count, story, organiser_id, cover_photo, status, paused_at, closed_at, completed_at, changes_requested_reason, documents_checked_at, last_edited_at, viral_video_url, beneficiary_confirmation, beneficiary_confirmed_name, beneficiary_confirmed_at, beneficiary_declined_at, created_at";

type Row = {
  id: string;
  slug: string;
  title: string;
  category: Category;
  organiser: string;
  beneficiary: string;
  location: string;
  goal: number;
  raised: number;
  donor_count: number;
  story: string;
  organiser_id: string | null;
  cover_photo: string | null;
  status: CampaignStatus;
  paused_at: string | null;
  closed_at: string | null;
  completed_at: string | null;
  changes_requested_reason: string | null;
  documents_checked_at: string | null;
  last_edited_at: string | null;
  viral_video_url: string | null;
  beneficiary_confirmation: boolean;
  beneficiary_confirmed_name: string | null;
  beneficiary_confirmed_at: string | null;
  beneficiary_declined_at: string | null;
  created_at: string;
};

function fromRow({
  donor_count,
  organiser_id,
  cover_photo,
  paused_at,
  closed_at,
  completed_at,
  changes_requested_reason,
  documents_checked_at,
  last_edited_at,
  viral_video_url,
  beneficiary_confirmation,
  beneficiary_confirmed_name,
  beneficiary_confirmed_at,
  beneficiary_declined_at,
  created_at,
  ...rest
}: Row): Campaign {
  return {
    ...rest,
    donorCount: donor_count,
    organiserId: organiser_id,
    coverPhoto: cover_photo,
    pausedAt: paused_at,
    closedAt: closed_at,
    completedAt: completed_at,
    changesRequestedReason: changes_requested_reason,
    documentsCheckedAt: documents_checked_at,
    lastEditedAt: last_edited_at,
    viralVideoUrl: viral_video_url,
    beneficiaryConfirmation: beneficiary_confirmation,
    beneficiaryConfirmedName: beneficiary_confirmed_name,
    beneficiaryConfirmedAt: beneficiary_confirmed_at,
    beneficiaryDeclinedAt: beneficiary_declined_at,
    createdAt: created_at,
  };
}

// Browse shows running campaigns (active and paused) and completed ones
// separately. Closed campaigns drop out, but their pages still open from old links.
export async function getCampaigns(show: "running" | "completed" = "running"): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(COLUMNS)
    .in("status", show === "completed" ? ["completed"] : ["active", "paused"])
    .order(show === "completed" ? "completed_at" : "created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function getCampaign(slug: string): Promise<Campaign | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : undefined;
}

export async function getCampaignById(id: string): Promise<Campaign | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : undefined;
}

// For the admin dashboard: every paused or closed campaign, plus the given ones
// (those with open reports, which may be active or completed).
export async function getCampaignsForReview(ids: string[]): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(COLUMNS)
    .or(ids.length > 0 ? `status.in.(paused,closed),id.in.(${ids.join(",")})` : "status.in.(paused,closed)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

// For the admin dashboard: campaigns waiting for approval, the organiser's
// changes or the beneficiary, oldest first so nobody waits too long.
export async function getCampaignsAwaitingApproval(): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(COLUMNS)
    .in("status", UNPUBLISHED_STATUSES)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function getCampaignsByIds(ids: string[]): Promise<Campaign[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(COLUMNS)
    .in("id", ids)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

// The organiser's campaigns that aren't public yet, so they can find them again.
export async function getMyUnpublishedCampaigns(organiserId: string): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(COLUMNS)
    .eq("organiser_id", organiserId)
    .in("status", UNPUBLISHED_STATUSES)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export type NewCampaign = Pick<
  Campaign,
  | "title"
  | "category"
  | "organiser"
  | "beneficiary"
  | "location"
  | "goal"
  | "story"
  | "viralVideoUrl"
  | "beneficiaryConfirmation"
>;

// Our own codes, plus the ones raised by supabase/reports.sql and
// supabase/organiser_verification.sql.
export type CreateError =
  | "not-logged-in"
  | "email-not-confirmed"
  | "declaration_required"
  | "campaign_limit"
  | "phone_not_verified"
  | "goal_too_high";

const CREATE_ERRORS = new Set<string>(["declaration_required", "campaign_limit", "phone_not_verified", "goal_too_high"]);

export type CreateResult = { campaign: Campaign } | { error: CreateError };

// declaration is the exact text the organiser ticked; the database stamps the time.
export async function createCampaign(input: NewCampaign, declaration: string): Promise<CreateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-logged-in" };
  if (!user.email_confirmed_at) return { error: "email-not-confirmed" };

  const { viralVideoUrl, beneficiaryConfirmation, ...details } = input;
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      ...details,
      viral_video_url: viralVideoUrl,
      beneficiary_confirmation: beneficiaryConfirmation,
      declaration,
      slug: await uniqueSlug(input.title),
      organiser_id: user.id,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    // Our database functions raise plain exceptions (code P0001) whose message is the error code.
    if (error.code === "P0001" && CREATE_ERRORS.has(error.message)) return { error: error.message as CreateError };
    throw error;
  }
  return { campaign: fromRow(data as Row) };
}

// Active, paused, pending and awaiting-beneficiary campaigns, which count toward MAX_OPEN_CAMPAIGNS.
export async function countOpenCampaigns(organiserId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("organiser_id", organiserId)
    .in("status", ["active", "paused", "pending", "awaiting_beneficiary"]);
  if (error) throw error;
  return count ?? 0;
}

// Whether the organiser has a completed or documents-checked harambee, so
// their goals aren't capped at NEW_ORGANISER_MAX_GOAL.
export async function isTrustedOrganiser(organiserId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("organiser_is_trusted", { p_user_id: organiserId });
  if (error) throw error;
  return data === true;
}

export type CampaignDetails = Pick<Campaign, "title" | "beneficiary" | "story" | "location" | "coverPhoto">;

export type UpdateError = "beneficiary_locked" | "goal_locked" | "goal_too_high" | "details_locked";

const UPDATE_ERRORS = new Set<string>(["beneficiary_locked", "goal_locked", "goal_too_high", "details_locked"]);

// Row-level security only lets the organiser change their own campaign. The
// database refuses a new beneficiary once there's a donation (supabase/reports.sql)
// or the beneficiary has confirmed, a new goal unless an admin requested changes
// (supabase/goal_edits.sql), and any change while waiting for the beneficiary
// (supabase/beneficiary_verification.sql).
// Leave goal out to keep it as it is.
export async function updateCampaignDetails(
  id: string,
  details: CampaignDetails & { goal?: number },
): Promise<{ ok: true } | { error: UpdateError }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({
      title: details.title,
      beneficiary: details.beneficiary,
      story: details.story,
      location: details.location,
      cover_photo: details.coverPhoto,
      ...(details.goal !== undefined && { goal: details.goal }),
    })
    .eq("id", id);
  if (!error) return { ok: true };
  if (error.code === "P0001" && UPDATE_ERRORS.has(error.message)) return { error: error.message as UpdateError };
  throw error;
}

export async function setCampaignCover(id: string, coverPhoto: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").update({ cover_photo: coverPhoto }).eq("id", id);
  if (error) throw error;
}

export type CompleteError =
  | "not_organiser"
  | "campaign_not_found"
  | "campaign_paused"
  | "campaign_closed"
  | "campaign_completed"
  | "campaign_not_live";

const COMPLETE_ERRORS = new Set<string>([
  "not_organiser",
  "campaign_not_found",
  "campaign_paused",
  "campaign_closed",
  "campaign_completed",
  "campaign_not_live",
]);

// "Close harambee": ends an active campaign for good. The database checks the
// caller is the organiser, and ends its live challenges.
export async function completeCampaign(id: string): Promise<{ ok: true } | { error: CompleteError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_campaign", { p_campaign_id: id });
  if (!error) return { ok: true };
  if (error.code === "P0001" && COMPLETE_ERRORS.has(error.message)) return { error: error.message as CompleteError };
  throw error;
}

export type ResubmitError = "not_organiser" | "campaign_not_found" | "not_changes_requested" | "campaign_limit";

const RESUBMIT_ERRORS = new Set<string>(["not_organiser", "campaign_not_found", "not_changes_requested", "campaign_limit"]);

// After an admin requested changes: back to waiting for approval.
export async function resubmitCampaign(id: string): Promise<{ ok: true } | { error: ResubmitError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resubmit_campaign", { p_campaign_id: id });
  if (!error) return { ok: true };
  if (error.code === "P0001" && RESUBMIT_ERRORS.has(error.message)) return { error: error.message as ResubmitError };
  throw error;
}

// Only finds slugs the user can see; the database renames on a clash with an
// unpublished campaign (supabase/organiser_verification.sql).
async function uniqueSlug(title: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "harambee";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("slug")
    .like("slug", `${base}%`);
  if (error) throw error;
  const taken = new Set(data.map((r) => r.slug));

  let slug = base;
  for (let n = 2; taken.has(slug); n++) {
    slug = `${base}-${n}`;
  }
  return slug;
}
