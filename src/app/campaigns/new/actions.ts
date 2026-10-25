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
import { getCurrentUser } from "@/lib/auth";
import { checkBeneficiaryPhone, sendBeneficiaryLink, type BeneficiaryPhoneError } from "@/lib/beneficiaries";
import { CATEGORIES, createCampaign, type Category, type CreateError } from "@/lib/campaigns";
import { normaliseKenyanPhone } from "@/lib/phone";
import { normaliseVideoUrl, VIRAL_CATEGORY } from "@/lib/videoLinks";

export type FormState = {
  errors: Partial<Record<Field, string>>;
  formError?: string;
  values: Partial<Record<Field, string>>;
  // Set instead of redirecting when a cover photo still has to be uploaded,
  // which can only happen once the campaign exists.
  created?: { id: string; slug: string };
};

type Field =
  | "title"
  | "category"
  | "organiser"
  | "beneficiary"
  | "location"
  | "goal"
  | "story"
  | "declaration"
  | "viral"
  | "videoUrl"
  | "confirmBeneficiary"
  | "beneficiaryName"
  | "beneficiaryPhone";

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

function beneficiaryPhoneError(code: BeneficiaryPhoneError): string {
  switch (code) {
    case "own_phone":
      return "That’s your own number. Enter the number of the person you’re raising for.";
    case "beneficiary_has_viral_campaign":
      return "This person already has a viral harambee running. Only one is allowed at a time.";
    default:
      return "Enter a Kenyan mobile number starting with 07 or 01.";
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
    viral: formData.get("viral") === "on" ? "on" : "",
    videoUrl: String(formData.get("videoUrl") ?? "").trim(),
    confirmBeneficiary: formData.get("confirmBeneficiary") === "on" ? "on" : "",
    beneficiaryName: String(formData.get("beneficiaryName") ?? "").trim().replace(/\s+/g, " "),
    beneficiaryPhone: String(formData.get("beneficiaryPhone") ?? "").trim(),
  };

  const errors: FormState["errors"] = campaignDetailErrors(values);
  if (!CATEGORIES.includes(values.category as Category)) errors.category = "Choose a category.";
  if (!values.organiser) errors.organiser = "Tell people who is organising.";
  if (!values.declaration) errors.declaration = "Please tick the box to confirm the information is true.";

  const goal = Number(values.goal);
  const goalProblem = goalError(goal);
  if (goalProblem) errors.goal = goalProblem;

  // Viral harambees always need the beneficiary's confirmation; others can ask for it.
  const viral = values.viral === "on" && values.category === VIRAL_CATEGORY;
  const videoUrl = viral ? normaliseVideoUrl(values.videoUrl) : null;
  if (viral && !videoUrl) errors.videoUrl = "Paste the link to the video on TikTok, Facebook, Instagram or YouTube.";
  const confirming = viral || values.confirmBeneficiary === "on";
  const beneficiaryPhone = confirming ? normaliseKenyanPhone(values.beneficiaryPhone) : null;
  if (confirming) {
    if (values.beneficiaryName.length < 2 || values.beneficiaryName.length > 100) {
      errors.beneficiaryName = "Enter their full name, as they’d recognise it.";
    }
    if (!beneficiaryPhone) errors.beneficiaryPhone = beneficiaryPhoneError("invalid_phone");
  }

  if (Object.keys(errors).length > 0) return { errors, values };

  // Checked before the harambee exists, so a problem doesn't leave one waiting.
  if (beneficiaryPhone) {
    const user = await getCurrentUser();
    if (!user) return { errors: {}, values, formError: friendlyError("not-logged-in") };
    const problem = await checkBeneficiaryPhone(user.id, beneficiaryPhone, viral);
    if (problem) return { errors: { beneficiaryPhone: beneficiaryPhoneError(problem) }, values };
  }

  const result = await createCampaign(
    {
      title: values.title,
      category: values.category as Category,
      organiser: values.organiser,
      beneficiary: values.beneficiary,
      location: values.location,
      goal,
      story: values.story,
      viralVideoUrl: videoUrl,
      beneficiaryConfirmation: confirming,
    },
    // The server's copy of the text, so what's stored is exactly what the form shows.
    CAMPAIGN_DECLARATION,
  );
  if ("error" in result) {
    if (result.error === "goal_too_high") return { errors: { goal: friendlyError(result.error) }, values };
    return { errors: {}, values, formError: friendlyError(result.error) };
  }
  const { id, slug } = result.campaign;
  // If this fails, the harambee page lets the organiser send it again.
  if (beneficiaryPhone && result.campaign.status === "awaiting_beneficiary") {
    try {
      const sent = await sendBeneficiaryLink(result.campaign, values.beneficiaryName, beneficiaryPhone);
      if ("error" in sent) console.error("sendBeneficiaryLink refused:", sent.error);
    } catch (error) {
      console.error("sendBeneficiaryLink failed:", error);
    }
  }
  if (formData.get("hasCover") === "1") return { errors: {}, values, created: { id, slug } };
  redirect(`/campaigns/${slug}`);
}
