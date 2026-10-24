"use server";

import { revalidatePath } from "next/cache";
import { reviewChallenge, type ChallengeError } from "@/lib/challenges";

export type ReviewState = { error?: string };

function friendlyError(code: ChallengeError): string {
  switch (code) {
    case "already_hosting":
      return "This host already has a live challenge here. Approve this one once it ends.";
    case "mgeni_rasmi_taken":
      return "Another Mgeni Rasmi is already running. Approve this one once it ends.";
    case "campaign_full":
      return "You already have 5 live challenges. Approve this one once one ends.";
    case "not_pending":
      return "This challenge has already been reviewed.";
    case "not_organiser":
      return "Only the organiser can review challenges. Please log in again.";
    default:
      return "We couldn’t find this challenge. Refresh the page and try again.";
  }
}

export async function reviewChallengeAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const challengeId = String(formData.get("challengeId") ?? "");
  const campaignSlug = String(formData.get("campaignSlug") ?? "");
  const approve = formData.get("decision") === "approve";

  const result = await reviewChallenge(challengeId, approve);
  revalidatePath(`/campaigns/${campaignSlug}/manage`);
  return "error" in result ? { error: friendlyError(result.error) } : {};
}
