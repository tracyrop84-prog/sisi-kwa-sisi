"use server";

import { redirect } from "next/navigation";
import { getCampaign } from "@/lib/campaigns";
import { CHALLENGE_TYPES, firstName, getChallenge, type Challenge } from "@/lib/challenges";
import {
  createDonation,
  MAX_DONATION,
  MAX_MESSAGE,
  MAX_NAME,
  MIN_DONATION,
  type DonationError,
} from "@/lib/donations";
import { formatKES } from "@/lib/format";

export type DonateState = {
  errors: Partial<Record<Field, string>>;
  formError?: string;
  values: Partial<Record<Field, string>>;
};

type Field = "donorName" | "amount" | "message";

function challengeError(code: DonationError, challenge: Challenge): string {
  switch (code) {
    case "challenge_not_live":
      return "This challenge isn’t running. You can still give to the harambee directly.";
    case "waiting_for_host":
      return `This challenge starts when ${firstName(challenge.hostName)} makes the first gift. Please try again soon.`;
    case "challenge_expired":
    case "challenge_ended":
      return "This challenge has ended. You can still give to the harambee directly.";
    case "below_preset":
      return `This is a ${CHALLENGE_TYPES[challenge.type].name}. Please give ${formatKES(CHALLENGE_TYPES[challenge.type].preset ?? 0)} or more.`;
    default:
      return "We couldn’t find this challenge. It may have been removed.";
  }
}

export async function donateAction(_prev: DonateState, formData: FormData): Promise<DonateState> {
  const slug = String(formData.get("slug") ?? "");
  const challengeSlug = String(formData.get("challenge") ?? ""); // empty for direct donations
  const anonymous = formData.get("anonymous") === "on";
  const values = {
    donorName: String(formData.get("donorName") ?? "").trim(),
    amount: String(formData.get("amount") ?? "").replace(/[,\s]/g, ""),
    message: String(formData.get("message") ?? "").trim(),
  };

  const errors: DonateState["errors"] = {};
  if (!anonymous && !values.donorName) errors.donorName = "Add your name, or tick “Give anonymously”.";
  if (values.donorName.length > MAX_NAME) errors.donorName = `Keep your name under ${MAX_NAME} characters.`;

  const amount = Number(values.amount);
  if (!Number.isInteger(amount) || amount < MIN_DONATION || amount > MAX_DONATION) {
    errors.amount = `Enter a whole amount between KES ${MIN_DONATION.toLocaleString("en-KE")} and KES ${MAX_DONATION.toLocaleString("en-KE")}.`;
  }
  if (values.message.length > MAX_MESSAGE) errors.message = `Keep your message under ${MAX_MESSAGE} characters.`;

  if (Object.keys(errors).length > 0) return { errors, values };

  const donation = {
    donorName: anonymous ? null : values.donorName,
    amount,
    message: values.message || null,
  };

  if (challengeSlug) {
    const challenge = await getChallenge(challengeSlug);
    if (!challenge) {
      return { errors: {}, values, formError: "We couldn’t find this challenge. It may have been removed." };
    }
    const preset = CHALLENGE_TYPES[challenge.type].preset;
    if (preset && amount < preset) {
      return { errors: { amount: challengeError("below_preset", challenge) }, values };
    }
    // The money goes to the campaign; challenge_id only records which challenge brought it in.
    const result = await createDonation({ ...donation, campaignId: challenge.campaignId, challengeId: challenge.id });
    if ("error" in result) return { errors: {}, values, formError: challengeError(result.error, challenge) };
    redirect(`/c/${challenge.slug}?thanks=1`);
  }

  const campaign = await getCampaign(slug);
  if (!campaign) {
    return { errors: {}, values, formError: "We couldn’t find this harambee. It may have been removed." };
  }

  await createDonation({ ...donation, campaignId: campaign.id });
  redirect(`/campaigns/${campaign.slug}?thanks=1`);
}
