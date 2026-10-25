import "server-only";
import type { Category } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";

// Campaigns live in the Supabase "campaigns" table (see supabase/campaigns.sql).
// Everything that reads or writes campaigns goes through this file.

export { CATEGORIES, type Category } from "@/lib/categories";

// active: taking donations. paused: under review, no donations (see
// supabase/reports.sql). closed: fraud confirmed, permanently. completed: the
// organiser ended it, permanently (see supabase/complete_campaign.sql).
export type CampaignStatus = "active" | "paused" | "closed" | "completed";

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
  createdAt: string;
};

const COLUMNS =
  "id, slug, title, category, organiser, beneficiary, location, goal, raised, donor_count, story, organiser_id, cover_photo, status, paused_at, closed_at, completed_at, created_at";

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
  created_at: string;
};

function fromRow({
  donor_count,
  organiser_id,
  cover_photo,
  paused_at,
  closed_at,
  completed_at,
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

export type NewCampaign = Pick<
  Campaign,
  "title" | "category" | "organiser" | "beneficiary" | "location" | "goal" | "story"
>;

// Our own codes, plus the ones raised by supabase/reports.sql.
export type CreateError = "not-logged-in" | "email-not-confirmed" | "declaration_required" | "campaign_limit";

export type CreateResult = { campaign: Campaign } | { error: CreateError };

// declaration is the exact text the organiser ticked; the database stamps the time.
export async function createCampaign(input: NewCampaign, declaration: string): Promise<CreateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-logged-in" };
  if (!user.email_confirmed_at) return { error: "email-not-confirmed" };

  const { data, error } = await supabase
    .from("campaigns")
    .insert({ ...input, declaration, slug: await uniqueSlug(input.title), organiser_id: user.id })
    .select(COLUMNS)
    .single();
  if (error) {
    // Our database functions raise plain exceptions (code P0001) whose message is the error code.
    if (error.code === "P0001" && (error.message === "declaration_required" || error.message === "campaign_limit")) {
      return { error: error.message as CreateError };
    }
    throw error;
  }
  return { campaign: fromRow(data as Row) };
}

// Active and paused campaigns, which count toward MAX_OPEN_CAMPAIGNS.
export async function countOpenCampaigns(organiserId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("organiser_id", organiserId)
    .in("status", ["active", "paused"]);
  if (error) throw error;
  return count ?? 0;
}

export type CampaignDetails = Pick<Campaign, "title" | "beneficiary" | "story" | "location" | "coverPhoto">;

// Row-level security only lets the organiser change their own campaign. The
// database refuses a new beneficiary once there's a donation (supabase/reports.sql).
export async function updateCampaignDetails(
  id: string,
  details: CampaignDetails,
): Promise<{ ok: true } | { error: "beneficiary_locked" }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({
      title: details.title,
      beneficiary: details.beneficiary,
      story: details.story,
      location: details.location,
      cover_photo: details.coverPhoto,
    })
    .eq("id", id);
  if (!error) return { ok: true };
  if (error.code === "P0001" && error.message === "beneficiary_locked") return { error: "beneficiary_locked" };
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
  | "campaign_completed";

const COMPLETE_ERRORS = new Set<string>([
  "not_organiser",
  "campaign_not_found",
  "campaign_paused",
  "campaign_closed",
  "campaign_completed",
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
