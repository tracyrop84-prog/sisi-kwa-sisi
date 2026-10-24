"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import {
  CHALLENGE_TYPES,
  createChallenge,
  DURATION_UNITS,
  durationLabel,
  MAX_DURATION_MINUTES,
  MAX_TARGET,
  MIN_DURATION_MINUTES,
  MIN_TARGET,
  QUICK_DURATIONS,
  type ChallengeError,
  type ChallengeType,
  type DurationUnit,
} from "@/lib/challenges";

export type ChallengeFormState = {
  errors: Partial<Record<Field, string>>;
  formError?: string;
  values: Partial<Record<Field, string>>;
};

type Field = "type" | "duration" | "durationAmount" | "durationUnit" | "target";

function friendlyError(code: ChallengeError): string {
  switch (code) {
    case "not-logged-in":
      return "You’ve been logged out. Please log in again, then submit.";
    case "email-not-confirmed":
      return "Please confirm your email first. Check your inbox for the link.";
    case "already_hosting":
      return "You already have a challenge waiting or running on this harambee. You can start another once it ends.";
    case "mgeni_rasmi_taken":
      return "Another Mgeni Rasmi is already running here. Choose a different type, or try again when it ends.";
    case "campaign_full":
      return "This harambee already has 5 live challenges. Try again when one ends.";
    case "no_organiser":
      return "This harambee can’t take challenges.";
    default:
      return "We couldn’t find this harambee. It may have been removed.";
  }
}

export async function createChallengeAction(
  _prev: ChallengeFormState,
  formData: FormData,
): Promise<ChallengeFormState> {
  const slug = String(formData.get("slug") ?? "");
  const values = {
    type: String(formData.get("type") ?? ""),
    duration: String(formData.get("duration") ?? ""), // a quick pick in minutes, or "custom"
    durationAmount: String(formData.get("durationAmount") ?? "").trim(),
    durationUnit: String(formData.get("durationUnit") ?? "hours"),
    target: String(formData.get("target") ?? "").replace(/[,\s]/g, ""),
  };

  const errors: ChallengeFormState["errors"] = {};
  if (!(values.type in CHALLENGE_TYPES)) errors.type = "Choose a challenge type.";
  let durationMinutes = NaN;
  if (values.duration === "custom") {
    const amount = Number(values.durationAmount);
    const unit = Object.hasOwn(DURATION_UNITS, values.durationUnit)
      ? DURATION_UNITS[values.durationUnit as DurationUnit]
      : undefined;
    if (!values.durationAmount || !Number.isFinite(amount) || amount <= 0 || !unit) {
      errors.durationAmount = "Enter how long it runs, e.g. 3 days.";
    } else {
      durationMinutes = Math.round(amount * unit);
      if (durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES) {
        errors.durationAmount = `Challenges run from ${durationLabel(MIN_DURATION_MINUTES)} to ${durationLabel(MAX_DURATION_MINUTES)}. You entered ${values.durationAmount} ${values.durationUnit}.`;
      }
    }
  } else {
    durationMinutes = Number(values.duration);
    if (!QUICK_DURATIONS.some((d) => d.minutes === durationMinutes)) errors.duration = "Choose how long it runs.";
  }

  const target = values.target ? Number(values.target) : null;
  if (target !== null && (!Number.isInteger(target) || target < MIN_TARGET || target > MAX_TARGET)) {
    errors.target = `Enter a whole amount between KES ${MIN_TARGET.toLocaleString("en-KE")} and KES ${MAX_TARGET.toLocaleString("en-KE")}, or leave it empty.`;
  }

  if (Object.keys(errors).length > 0) return { errors, values };

  const [user, campaign] = await Promise.all([getCurrentUser(), getCampaign(slug)]);
  if (!user) return { errors: {}, values, formError: friendlyError("not-logged-in") };
  if (!campaign) return { errors: {}, values, formError: friendlyError("campaign_not_found") };

  const result = await createChallenge({
    campaignId: campaign.id,
    hostName: user.name,
    type: values.type as ChallengeType,
    durationMinutes,
    target,
  });
  if ("error" in result) return { errors: {}, values, formError: friendlyError(result.error) };

  const live = result.challenge.status === "approved";
  redirect(`/campaigns/${campaign.slug}?challenge=${live ? "live" : "pending"}`);
}
