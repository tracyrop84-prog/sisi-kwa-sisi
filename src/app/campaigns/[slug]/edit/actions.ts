"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  campaignDetailErrors,
  goalCapMessage,
  goalError,
  NEW_ORGANISER_MAX_GOAL,
  type DetailField,
} from "@/lib/campaignRules";
import {
  canEditDetails,
  getCampaign,
  isTrustedOrganiser,
  setCampaignCover,
  updateCampaignDetails,
  type Campaign,
} from "@/lib/campaigns";
import { notifyBeneficiaryOfEdit } from "@/lib/beneficiaries";
import { isPhotoPath } from "@/lib/photos";
import { removePhotos } from "@/lib/updates";

// The forms upload the cover photo to Storage first, then send its path here.
// goalInput is what was typed in the goal field, which only shows while an
// admin has requested changes; null otherwise.

export type EditCampaignState = { errors: Partial<Record<DetailField | "goal", string>>; formError?: string };

const NOT_ORGANISER = "Only the organiser can edit this harambee. Please log in again.";
const UNDER_REVIEW = "This harambee is under review, closed or has ended, so its details can’t be edited.";
const AWAITING_BENEFICIARY = "This harambee can’t be edited while we wait for the person it’s for to confirm it.";
const BENEFICIARY_LOCKED = "Who the money is for can’t be changed once the harambee has a donation or has been confirmed.";
const GOAL_LOCKED = "The goal can only be changed while our team is asking for changes.";

async function organiserCampaign(slug: string): Promise<Campaign | null> {
  const [user, campaign] = await Promise.all([getCurrentUser(), getCampaign(slug)]);
  return user && campaign && campaign.organiserId === user.id ? campaign : null;
}

function validCover(path: unknown, campaignId: string): path is string | null {
  return path === null || isPhotoPath(path, campaignId, "cover");
}

export async function editCampaignAction(
  slug: string,
  input: Record<DetailField, string>,
  coverPhoto: string | null,
  goalInput: string | null = null,
): Promise<EditCampaignState> {
  const text = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  const details = {
    title: text(input?.title),
    beneficiary: text(input?.beneficiary),
    location: text(input?.location),
    story: text(input?.story),
  };

  const campaign = await organiserCampaign(slug);
  if (!campaign || !validCover(coverPhoto, campaign.id)) return { errors: {}, formError: NOT_ORGANISER };
  const newCover = coverPhoto !== campaign.coverPhoto ? coverPhoto : null;
  // The database ignores edits then, so say so instead of pretending to save.
  if (!canEditDetails(campaign.status)) {
    if (newCover) await removePhotos([newCover]);
    return { errors: {}, formError: campaign.status === "awaiting_beneficiary" ? AWAITING_BENEFICIARY : UNDER_REVIEW };
  }

  const errors: EditCampaignState["errors"] = campaignDetailErrors(details);
  // The database refuses this too (supabase/reports.sql, supabase/beneficiary_verification.sql).
  const beneficiaryLocked = campaign.donorCount > 0 || campaign.beneficiaryConfirmedAt !== null;
  if (details.beneficiary !== campaign.beneficiary && beneficiaryLocked) errors.beneficiary = BENEFICIARY_LOCKED;

  // Only sent to the database when it changed; it checks the same rules (supabase/goal_edits.sql).
  let goal: number | undefined;
  if (typeof goalInput === "string") {
    const typed = Number(goalInput.replace(/[,\s]/g, ""));
    if (typed !== campaign.goal) {
      if (campaign.status !== "changes_requested") {
        errors.goal = GOAL_LOCKED;
      } else {
        const trusted = campaign.organiserId ? await isTrustedOrganiser(campaign.organiserId) : false;
        const problem = goalError(typed, trusted ? null : NEW_ORGANISER_MAX_GOAL);
        if (problem) errors.goal = problem;
        else goal = typed;
      }
    }
  }
  if (Object.keys(errors).length > 0) {
    if (newCover) await removePhotos([newCover]);
    return { errors };
  }

  try {
    // A donation can land, or the harambee be resubmitted, between loading it and saving.
    const result = await updateCampaignDetails(campaign.id, { ...details, coverPhoto, goal });
    if ("error" in result) {
      if (newCover) await removePhotos([newCover]);
      if (result.error === "goal_locked") return { errors: { goal: GOAL_LOCKED } };
      if (result.error === "goal_too_high") return { errors: { goal: goalCapMessage(NEW_ORGANISER_MAX_GOAL) } };
      if (result.error === "details_locked") return { errors: {}, formError: AWAITING_BENEFICIARY };
      return { errors: { beneficiary: BENEFICIARY_LOCKED } };
    }
  } catch (error) {
    console.error("updateCampaignDetails failed:", error);
    if (newCover) await removePhotos([newCover]);
    return { errors: {}, formError: "We couldn’t save your changes. Please try again." };
  }
  if (campaign.coverPhoto && campaign.coverPhoto !== coverPhoto) await removePhotos([campaign.coverPhoto]);
  // The database queued a notice if the story or goal changed.
  if (campaign.beneficiaryConfirmedAt) {
    try {
      await notifyBeneficiaryOfEdit(campaign);
    } catch (error) {
      console.error("notifyBeneficiaryOfEdit failed:", error);
    }
  }
  redirect(`/campaigns/${campaign.slug}?edited=1`);
}

// Straight after creating a campaign, once its cover photo has uploaded.
export async function setCoverAction(slug: string, coverPhoto: string): Promise<{ error?: string }> {
  const campaign = await organiserCampaign(slug);
  if (!campaign || !isPhotoPath(coverPhoto, campaign.id, "cover")) return { error: NOT_ORGANISER };
  // A harambee waiting for its beneficiary only locks its details, not the photo.
  if (!canEditDetails(campaign.status) && campaign.status !== "awaiting_beneficiary") {
    await removePhotos([coverPhoto]);
    return { error: UNDER_REVIEW };
  }
  try {
    await setCampaignCover(campaign.id, coverPhoto);
  } catch (error) {
    console.error("setCampaignCover failed:", error);
    await removePhotos([coverPhoto]);
    return { error: "We couldn’t save the cover photo." };
  }
  if (campaign.coverPhoto) await removePhotos([campaign.coverPhoto]);
  return {};
}
