"use server";

import { redirect } from "next/navigation";
import { CATEGORIES, createCampaign, type Category } from "@/lib/campaigns";

export type FormState = {
  errors: Partial<Record<Field, string>>;
  formError?: string;
  values: Partial<Record<Field, string>>;
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

  const errors: FormState["errors"] = {};
  if (values.title.length < 5) errors.title = "Give your harambee a title (at least 5 characters).";
  if (values.title.length > 100) errors.title = "Keep the title under 100 characters.";
  if (!CATEGORIES.includes(values.category as Category)) errors.category = "Choose a category.";
  if (!values.organiser) errors.organiser = "Tell people who is organising.";
  if (!values.beneficiary) errors.beneficiary = "Tell people who the money is for.";
  if (!values.location) errors.location = "Add a town or county.";

  const goal = Number(values.goal);
  if (!Number.isInteger(goal) || goal < MIN_GOAL || goal > MAX_GOAL) {
    errors.goal = `Enter a whole amount between KES ${MIN_GOAL.toLocaleString("en-KE")} and KES ${MAX_GOAL.toLocaleString("en-KE")}.`;
  }
  if (values.story.length < 30) errors.story = "Share a bit more of the story (at least 30 characters).";

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
  redirect(`/campaigns/${result.campaign.slug}`);
}
