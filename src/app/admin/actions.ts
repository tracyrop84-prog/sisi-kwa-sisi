"use server";

import { revalidatePath } from "next/cache";
import { approveCampaign, markDocumentsChecked, requestChanges, type ApprovalError } from "@/lib/approvals";
import { MAX_CHANGES_REASON } from "@/lib/campaignRules";
import { isReviewDecision, reviewCampaign, type ReportError } from "@/lib/reports";

export type AdminActionState = { error?: string };

function friendlyError(code: ReportError): string {
  switch (code) {
    case "not_admin":
      return "Only admins can do this. Please log in again.";
    case "campaign_closed":
      return "This harambee is already closed, so it can’t be changed.";
    default:
      return "We couldn’t find this harambee. Refresh the page and try again.";
  }
}

export async function reviewCampaignAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaignSlug = String(formData.get("campaignSlug") ?? "");
  const decision = formData.get("decision");
  if (!isReviewDecision(decision)) return { error: "Choose what to do." };

  const result = await reviewCampaign(campaignId, decision);
  revalidatePath("/admin");
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignSlug}`);
  return "error" in result ? { error: friendlyError(result.error) } : {};
}

function approvalError(code: ApprovalError): string {
  switch (code) {
    case "not_admin":
      return "Only admins can do this. Please log in again.";
    case "campaign_closed":
      return "This harambee is already closed, so it can’t be changed.";
    case "not_pending":
      return "This harambee isn’t waiting for approval any more. Refresh the page.";
    case "reason_required":
      return "Tell the organiser what to change.";
    case "no_documents":
      return "There are no documents to check yet.";
    default:
      return "We couldn’t find this harambee. Refresh the page and try again.";
  }
}

function revalidateCampaign(formData: FormData) {
  revalidatePath("/admin");
  revalidatePath(`/admin/campaigns/${String(formData.get("campaignId") ?? "")}`);
  revalidatePath(`/campaigns/${String(formData.get("campaignSlug") ?? "")}`);
}

// Approve, or request changes with a reason the organiser will see.
export async function approvalAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const campaignId = String(formData.get("campaignId") ?? "");
  const decision = formData.get("decision");
  const reason = String(formData.get("reason") ?? "").trim();

  let result;
  if (decision === "approve") {
    result = await approveCampaign(campaignId);
  } else if (decision === "changes") {
    if (!reason) return { error: approvalError("reason_required") };
    if (reason.length > MAX_CHANGES_REASON) return { error: `Keep it under ${MAX_CHANGES_REASON} characters.` };
    result = await requestChanges(campaignId, reason);
  } else {
    return { error: "Choose what to do." };
  }
  revalidateCampaign(formData);
  return "error" in result ? { error: approvalError(result.error) } : {};
}

export async function documentsCheckedAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const result = await markDocumentsChecked(String(formData.get("campaignId") ?? ""));
  revalidateCampaign(formData);
  return "error" in result ? { error: approvalError(result.error) } : {};
}
