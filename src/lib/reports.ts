import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { getCampaignsForReview, type Campaign } from "@/lib/campaigns";
import { createClient } from "@/lib/supabase/server";

// Reports live in the Supabase "reports" table (see supabase/reports.sql).
// Only admins can read them; reporters stay anonymous to organisers.
// A campaign pauses automatically once 3 different users have reported it.

// Keep in sync with the reason check in supabase/reports.sql.
export const REPORT_REASONS = {
  scam: "Scam or fake campaign",
  impersonation: "Pretending to be someone else",
  misuse: "Money not used as promised",
  inappropriate: "Inappropriate content",
  other: "Other",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

export const MAX_REPORT_DETAILS = 1000;

export function isReportReason(x: unknown): x is ReportReason {
  return typeof x === "string" && Object.hasOwn(REPORT_REASONS, x);
}

// Error codes raised by supabase/reports.sql, plus our own.
export type ReportError =
  | "not-logged-in"
  | "email-not-confirmed"
  | "already_reported"
  | "own_campaign"
  | "campaign_closed"
  | "campaign_not_found"
  | "not_admin";

const DB_ERRORS = new Set<string>(["own_campaign", "campaign_closed", "campaign_not_found", "not_admin"]);

// Our database functions raise plain exceptions (code P0001) whose message is the error code.
function knownError(error: { code?: string; message: string }): ReportError | null {
  if (error.code === "23505") return "already_reported"; // one open report per user per campaign
  return error.code === "P0001" && DB_ERRORS.has(error.message) ? (error.message as ReportError) : null;
}

export type ReportResult = { ok: true } | { error: ReportError };

export async function createReport(
  campaignId: string,
  reason: ReportReason,
  details: string | null,
): Promise<ReportResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "not-logged-in" };
  if (!user.emailConfirmed) return { error: "email-not-confirmed" };

  const supabase = await createClient();
  // No .select(): reporters can't read reports back, not even their own.
  const { error } = await supabase.from("reports").insert({ campaign_id: campaignId, reason, details });
  if (!error) return { ok: true };
  const known = knownError(error);
  if (known) return { error: known };
  throw error;
}

// Whether the logged-in user has an open report on this campaign.
export async function hasReported(campaignId: string): Promise<boolean> {
  if (!(await getCurrentUser())) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_reported", { p_campaign_id: campaignId });
  if (error) throw error;
  return data === true;
}

// Admin review ----------------------------------------------------------------

export type Report = {
  id: string;
  campaignId: string;
  reason: ReportReason;
  details: string | null;
  status: "open" | "resolved";
  resolution: "cleared" | "fraud" | null;
  createdAt: string;
};

export type CampaignUnderReview = { campaign: Campaign; reports: Report[]; openReports: number };

// Paused and closed campaigns, and live ones with open reports, each with all
// its reports (newest first). Row-level security returns no reports to non-admins.
export async function getCampaignsUnderReview(): Promise<CampaignUnderReview[]> {
  const supabase = await createClient();
  const { data: open, error: openError } = await supabase
    .from("reports")
    .select("campaign_id")
    .eq("status", "open");
  if (openError) throw openError;

  const campaigns = await getCampaignsForReview([...new Set(open.map((r) => r.campaign_id as string))]);
  if (campaigns.length === 0) return [];

  const { data, error } = await supabase
    .from("reports")
    .select("id, campaign_id, reason, details, status, resolution, created_at")
    .in("campaign_id", campaigns.map((c) => c.id))
    .order("created_at", { ascending: false });
  if (error) throw error;

  const reports: Report[] = data.map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    resolution: r.resolution,
    createdAt: r.created_at,
  }));
  return campaigns.map((campaign) => {
    const own = reports.filter((r) => r.campaignId === campaign.id);
    return { campaign, reports: own, openReports: own.filter((r) => r.status === "open").length };
  });
}

export type ReviewDecision = "pause" | "clear" | "fraud";

const REVIEW_FUNCTIONS = {
  pause: "admin_pause_campaign",
  clear: "admin_clear_campaign",
  fraud: "admin_confirm_fraud",
} as const;

export function isReviewDecision(x: unknown): x is ReviewDecision {
  return typeof x === "string" && Object.hasOwn(REVIEW_FUNCTIONS, x);
}

// The database checks the caller is an admin, and refuses to touch a closed campaign.
export async function reviewCampaign(campaignId: string, decision: ReviewDecision): Promise<ReportResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(REVIEW_FUNCTIONS[decision], { p_campaign_id: campaignId });
  if (!error) return { ok: true };
  const known = knownError(error);
  if (known) return { error: known };
  throw error;
}
