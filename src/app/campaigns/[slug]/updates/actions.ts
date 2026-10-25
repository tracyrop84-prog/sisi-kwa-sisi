"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign, type Campaign } from "@/lib/campaigns";
import { isPhotoPath } from "@/lib/photos";
import { createUpdate, deleteUpdate, editUpdate, getUpdate, removePhotos } from "@/lib/updates";
import { isUpdateType, updateErrors, type UpdateErrors, type UpdateValues } from "@/lib/updateTypes";

// The form uploads photos to Storage first, then sends their paths here.

export type UpdateFormState = { errors: UpdateErrors; formError?: string };

const NOT_ORGANISER = "Only the organiser can post updates. Please log in again.";

async function organiserCampaign(slug: string): Promise<Campaign | null> {
  const [user, campaign] = await Promise.all([getCurrentUser(), getCampaign(slug)]);
  if (!user || !campaign || campaign.organiserId !== user.id || !user.emailConfirmed) return null;
  return campaign;
}

// Values arrive from the browser, so make sure each one is the expected kind.
function clean(v: UpdateValues): UpdateValues {
  const text = (x: unknown) => (typeof x === "string" ? x : "");
  return {
    type: text(v?.type),
    body: text(v?.body),
    giftItem: text(v?.giftItem),
    giftGiver: text(v?.giftGiver),
    giftAnonymous: v?.giftAnonymous === true,
    giftValue: text(v?.giftValue),
    recoveryStatus: text(v?.recoveryStatus),
    consent: v?.consent === true,
  };
}

function badPhotos(photos: unknown, campaignId: string): boolean {
  return !Array.isArray(photos) || !photos.every((p) => isPhotoPath(p, campaignId, "updates"));
}

export async function createUpdateAction(
  slug: string,
  values: UpdateValues,
  photos: string[],
): Promise<UpdateFormState> {
  values = clean(values);
  const campaign = await organiserCampaign(slug);
  if (!campaign || badPhotos(photos, campaign.id) || !isUpdateType(values.type)) {
    return { errors: {}, formError: NOT_ORGANISER };
  }

  const errors = updateErrors(values, photos.length, campaign.category);
  if (Object.keys(errors).length > 0) {
    await removePhotos(photos);
    return { errors };
  }

  let id: string;
  try {
    id = (await createUpdate(campaign.id, values.type, values, photos)).id;
  } catch (error) {
    console.error("createUpdate failed:", error);
    await removePhotos(photos);
    return { errors: {}, formError: "We couldn’t post the update. Please try again." };
  }
  redirect(`/campaigns/${campaign.slug}?update=posted#update-${id}`);
}

export async function editUpdateAction(
  slug: string,
  updateId: string,
  values: UpdateValues,
  photos: string[],
): Promise<UpdateFormState> {
  values = clean(values);
  const campaign = await organiserCampaign(slug);
  const update = campaign && (await getUpdate(updateId));
  if (!campaign || !update || update.campaignId !== campaign.id || badPhotos(photos, campaign.id)) {
    return { errors: {}, formError: NOT_ORGANISER };
  }
  const added = photos.filter((p) => !update.photos.includes(p));
  const removed = update.photos.filter((p) => !photos.includes(p));

  // The type can't change, so check against the saved one.
  const errors = updateErrors({ ...values, type: update.type }, photos.length);
  if (Object.keys(errors).length > 0) {
    await removePhotos(added);
    return { errors };
  }

  try {
    await editUpdate(update, values, photos);
  } catch (error) {
    console.error("editUpdate failed:", error);
    await removePhotos(added);
    return { errors: {}, formError: "We couldn’t save your changes. Please try again." };
  }
  await removePhotos(removed);
  redirect(`/campaigns/${campaign.slug}#update-${update.id}`);
}

export async function deleteUpdateAction(slug: string, updateId: string): Promise<{ error?: string }> {
  const campaign = await organiserCampaign(slug);
  const update = campaign && (await getUpdate(updateId));
  if (!campaign || !update || update.campaignId !== campaign.id) return { error: NOT_ORGANISER };

  try {
    await deleteUpdate(update.id);
  } catch (error) {
    console.error("deleteUpdate failed:", error);
    return { error: "We couldn’t delete the update. Please try again." };
  }
  await removePhotos(update.photos);
  redirect(`/campaigns/${campaign.slug}?update=deleted`);
}
