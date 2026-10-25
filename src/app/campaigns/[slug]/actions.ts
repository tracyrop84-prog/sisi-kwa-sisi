"use server";

import { revalidatePath } from "next/cache";
import { MAX_OPEN_CAMPAIGNS } from "@/lib/campaignRules";
import {
  completeCampaign,
  getCampaign,
  resubmitCampaign,
  type CompleteError,
  type ResubmitError,
} from "@/lib/campaigns";

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
    case "campaign_not_live":
      return "This harambee hasn’t been approved yet, so there’s nothing to close.";
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

export type ResubmitState = { error?: string };

function resubmitError(code: ResubmitError): string {
  switch (code) {
    case "not_organiser":
      return "Only the organiser can resubmit this harambee. Please log in again.";
    case "not_changes_requested":
      return "This harambee has already been resubmitted. Refresh the page.";
    case "campaign_limit":
      return `You already have ${MAX_OPEN_CAMPAIGNS} active or waiting harambees. Close one before resubmitting this.`;
    default:
      return "We couldn’t find this harambee. Refresh the page and try again.";
  }
}

export async function resubmitAction(_prev: ResubmitState, formData: FormData): Promise<ResubmitState> {
  const campaign = await getCampaign(String(formData.get("slug") ?? ""));
  if (!campaign) return { error: resubmitError("campaign_not_found") };

  const result = await resubmitCampaign(campaign.id);
  revalidatePath(`/campaigns/${campaign.slug}`);
  return "error" in result ? { error: resubmitError(result.error) } : {};
}
