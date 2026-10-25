"use server";

import { redirect } from "next/navigation";
import {
  CAMPAIGN_DECLARATION,
  campaignDetailErrors,
  goalCapMessage,
  goalError,
  MAX_OPEN_CAMPAIGNS,
  NEW_ORGANISER_MAX_GOAL,
} from "@/lib/campaignRules";
import { CATEGORIES, createCampaign, type Category, type CreateError } from "@/lib/campaigns";

export type FormState = {
  errors: Partial<Record<Field, string>>;
  formError?: string;
  values: Partial<Record<Field, string>>;
  // Set instead of redirecting when a cover photo still has to be uploaded,
  // which can only happen once the campaign exists.
  created?: { id: string; slug: string };
};

type Field = "title" | "category" | "organiser" | "beneficiary" | "location" | "goal" | "story" | "declaration";

function friendlyError(code: CreateError): string {
  switch (code) {
    case "email-not-confirmed":
      return "Please confirm your email first. Check your inbox for the link.";
    case "declaration_required":
      return "Please tick the box to confirm the information is true.";
    case "campaign_limit":
      return `You already have ${MAX_OPEN_CAMPAIGNS} active harambees, which is the most you can run at once.`;
    case "phone_not_verified":
      return "Please verify your phone number first.";
    case "goal_too_high":
      return goalCapMessage(NEW_ORGANISER_MAX_GOAL);
    default:
      return "You’ve been logged out. Please log in again, then submit.";
  }
}

export async function createCampaignAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    title: String(formData.get("title") ?? "").trim(),
    category: String(formData.get("category") ?? ""),
    organiser: String(formData.get("organiser") ?? "").trim(),
    beneficiary: String(formData.get("beneficiary") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    goal: String(formData.get("goal") ?? "").replace(/[,\s]/g, ""),
    story: String(formData.get("story") ?? "").trim(),
    declaration: formData.get("declaration") === "on" ? "on" : "",
  };

  const errors: FormState["errors"] = campaignDetailErrors(values);
  if (!CATEGORIES.includes(values.category as Category)) errors.category = "Choose a category.";
  if (!values.organiser) errors.organiser = "Tell people who is organising.";
  if (!values.declaration) errors.declaration = "Please tick the box to confirm the information is true.";

  const goal = Number(values.goal);
  const goalProblem = goalError(goal);
  if (goalProblem) errors.goal = goalProblem;

  if (Object.keys(errors).length > 0) return { errors, values };

  const result = await createCampaign(
    {
      title: values.title,
      category: values.category as Category,
      organiser: values.organiser,
      beneficiary: values.beneficiary,
      location: values.location,
      goal,
      story: values.story,
    },
    // The server's copy of the text, so what's stored is exactly what the form shows.
    CAMPAIGN_DECLARATION,
  );
  if ("error" in result) {
    if (result.error === "goal_too_high") return { errors: { goal: friendlyError(result.error) }, values };
    return { errors: {}, values, formError: friendlyError(result.error) };
  }
  const { id, slug } = result.campaign;
  if (formData.get("hasCover") === "1") return { errors: {}, values, created: { id, slug } };
  redirect(`/campaigns/${slug}`);
}
