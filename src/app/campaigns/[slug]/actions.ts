"use server";

import { revalidatePath } from "next/cache";
import { completeCampaign, getCampaign, type CompleteError } from "@/lib/campaigns";

export type CloseState = { error?: string };

function friendlyError(code: CompleteError): string {
  switch (code) {
    case "not_organiser":
      return "Only the organiser can close this harambee. Please log in again.";
    case "campaign_paused":
      return "This harambee is under review, so it can’t be closed until the review is done.";
    case "campaign_closed":
    case "campaign_completed":
      return "This harambee has already ended.";
    default:
      return "We couldn’t find this harambee. Refresh the page and try again.";
  }
}

export async function closeHarambeeAction(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const campaign = await getCampaign(String(formData.get("slug") ?? ""));
  if (!campaign) return { error: friendlyError("campaign_not_found") };

  const result = await completeCampaign(campaign.id);
  revalidatePath(`/campaigns/${campaign.slug}`);
  return "error" in result ? { error: friendlyError(result.error) } : {};
}
