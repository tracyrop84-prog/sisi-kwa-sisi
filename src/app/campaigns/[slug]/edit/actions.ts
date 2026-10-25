"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { campaignDetailErrors, type DetailField } from "@/lib/campaignRules";
import { getCampaign, setCampaignCover, updateCampaignDetails, type Campaign } from "@/lib/campaigns";
import { isPhotoPath } from "@/lib/photos";
import { removePhotos } from "@/lib/updates";

// The forms upload the cover photo to Storage first, then send its path here.

export type EditCampaignState = { errors: Partial<Record<DetailField, string>>; formError?: string };

const NOT_ORGANISER = "Only the organiser can edit this harambee. Please log in again.";
const UNDER_REVIEW = "This harambee is under review, closed or has ended, so its details can’t be edited.";
const BENEFICIARY_LOCKED = "Who the money is for can’t be changed once the harambee has a donation.";

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
  if (campaign.status !== "active") {
    if (newCover) await removePhotos([newCover]);
    return { errors: {}, formError: UNDER_REVIEW };
  }

  const errors = campaignDetailErrors(details);
  // The database refuses this too (supabase/reports.sql).
  if (details.beneficiary !== campaign.beneficiary && campaign.donorCount > 0) errors.beneficiary = BENEFICIARY_LOCKED;
  if (Object.keys(errors).length > 0) {
    if (newCover) await removePhotos([newCover]);
    return { errors };
  }

  try {
    // A donation can land between loading the campaign and saving.
    if ("error" in (await updateCampaignDetails(campaign.id, { ...details, coverPhoto }))) {
      if (newCover) await removePhotos([newCover]);
      return { errors: { beneficiary: BENEFICIARY_LOCKED } };
    }
  } catch (error) {
    console.error("updateCampaignDetails failed:", error);
    if (newCover) await removePhotos([newCover]);
    return { errors: {}, formError: "We couldn’t save your changes. Please try again." };
  }
  if (campaign.coverPhoto && campaign.coverPhoto !== coverPhoto) await removePhotos([campaign.coverPhoto]);
  redirect(`/campaigns/${campaign.slug}?edited=1`);
}

// Straight after creating a campaign, once its cover photo has uploaded.
export async function setCoverAction(slug: string, coverPhoto: string): Promise<{ error?: string }> {
  const campaign = await organiserCampaign(slug);
  if (!campaign || !isPhotoPath(coverPhoto, campaign.id, "cover")) return { error: NOT_ORGANISER };
  if (campaign.status !== "active") {
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
