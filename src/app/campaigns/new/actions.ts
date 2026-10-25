"use server";

import { redirect } from "next/navigation";
import { campaignDetailErrors } from "@/lib/campaignRules";
import { CATEGORIES, createCampaign, type Category } from "@/lib/campaigns";

export type FormState = {
  errors: Partial<Record<Field, string>>;
  formError?: string;
  values: Partial<Record<Field, string>>;
  // Set instead of redirecting when a cover photo still has to be uploaded,
  // which can only happen once the campaign exists.
  created?: { id: string; slug: string };
};

type Field = "title" | "category" | "organiser" | "beneficiary" | "location" | "goal" | "story";

const MIN_GOAL = 1000;
const MAX_GOAL = 50_000_000;

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
  };

  const errors: FormState["errors"] = campaignDetailErrors(values);
  if (!CATEGORIES.includes(values.category as Category)) errors.category = "Choose a category.";
  if (!values.organiser) errors.organiser = "Tell people who is organising.";
  if (!values.beneficiary) errors.beneficiary = "Tell people who the money is for.";

  const goal = Number(values.goal);
  if (!Number.isInteger(goal) || goal < MIN_GOAL || goal > MAX_GOAL) {
    errors.goal = `Enter a whole amount between KES ${MIN_GOAL.toLocaleString("en-KE")} and KES ${MAX_GOAL.toLocaleString("en-KE")}.`;
  }

  if (Object.keys(errors).length > 0) return { errors, values };

  const result = await createCampaign({
    ...values,
    category: values.category as Category,
    goal,
  });
  if ("error" in result) {
    const formError =
      result.error === "email-not-confirmed"
        ? "Please confirm your email first. Check your inbox for the link."
        : "You’ve been logged out. Please log in again, then submit.";
    return { errors: {}, values, formError };
  }
  const { id, slug } = result.campaign;
  if (formData.get("hasCover") === "1") return { errors: {}, values, created: { id, slug } };
  redirect(`/campaigns/${slug}`);
}
