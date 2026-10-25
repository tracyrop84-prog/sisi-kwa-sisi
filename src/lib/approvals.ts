import "server-only";
import { createClient } from "@/lib/supabase/server";

// Admin approval and document checks (see supabase/organiser_verification.sql).
// The database checks the caller is an admin.

export type ApprovalError = "not_admin" | "campaign_not_found" | "campaign_closed" | "not_pending" | "reason_required" | "no_documents";

const DB_ERRORS = new Set<string>(["not_admin", "campaign_not_found", "campaign_closed", "not_pending", "reason_required", "no_documents"]);

type Result = { ok: true } | { error: ApprovalError };

async function call(fn: string, args: Record<string, unknown>): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (!error) return { ok: true };
  // Our database functions raise plain exceptions (code P0001) whose message is the error code.
  if (error.code === "P0001" && DB_ERRORS.has(error.message)) return { error: error.message as ApprovalError };
  throw error;
}

// Pending → live.
export function approveCampaign(campaignId: string): Promise<Result> {
  return call("admin_approve_campaign", { p_campaign_id: campaignId });
}

// Pending → changes requested. The organiser sees the reason.
export function requestChanges(campaignId: string, reason: string): Promise<Result> {
  return call("admin_request_changes", { p_campaign_id: campaignId, p_reason: reason });
}

// Shows the badge and locks the documents.
export function markDocumentsChecked(campaignId: string): Promise<Result> {
  return call("admin_mark_documents_checked", { p_campaign_id: campaignId });
}
