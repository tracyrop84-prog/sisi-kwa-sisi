"use server";

import { revalidatePath } from "next/cache";
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
  revalidatePath(`/campaigns/${campaignSlug}`);
  return "error" in result ? { error: friendlyError(result.error) } : {};
}
