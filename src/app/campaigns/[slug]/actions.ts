"use server";

import { revalidatePath } from "next/cache";
import { getBeneficiaryLink, sendBeneficiaryLink, type SendLinkError } from "@/lib/beneficiaries";
import { MAX_OPEN_CAMPAIGNS } from "@/lib/campaignRules";
import {
  completeCampaign,
  getCampaign,
  resubmitCampaign,
  type CompleteError,
  type ResubmitError,
} from "@/lib/campaigns";
import { normaliseKenyanPhone } from "@/lib/phone";

export type CloseState = { error?: string };

function friendlyError(code: CompleteError): string {
  switch (code) {
    case "not_organiser":
      return "Only the organiser can close this harambee. Please log in again.";
    case "campaign_paused":
      return "This harambee is under review, so it can’t be closed until the review is done.";
    case "campaign_closed":
    case "campaign_completed":
      return "This harambee has already ended.";
    case "campaign_not_live":
      return "This harambee hasn’t been approved yet, so there’s nothing to close.";
    default:
      return "We couldn’t find this harambee. Refresh the page and try again.";
  }
}

export async function closeHarambeeAction(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const campaign = await getCampaign(String(formData.get("slug") ?? ""));
  if (!campaign) return { error: friendlyError("campaign_not_found") };

  const result = await completeCampaign(campaign.id);
  revalidatePath(`/campaigns/${campaign.slug}`);
  return "error" in result ? { error: friendlyError(result.error) } : {};
}

export type ResubmitState = { error?: string };

function resubmitError(code: ResubmitError): string {
  switch (code) {
    case "not_organiser":
      return "Only the organiser can resubmit this harambee. Please log in again.";
    case "not_changes_requested":
      return "This harambee has already been resubmitted. Refresh the page.";
    case "campaign_limit":
      return `You already have ${MAX_OPEN_CAMPAIGNS} active or waiting harambees. Close one before resubmitting this.`;
    default:
      return "We couldn’t find this harambee. Refresh the page and try again.";
  }
}

export async function resubmitAction(_prev: ResubmitState, formData: FormData): Promise<ResubmitState> {
  const campaign = await getCampaign(String(formData.get("slug") ?? ""));
  if (!campaign) return { error: resubmitError("campaign_not_found") };

  const result = await resubmitCampaign(campaign.id);
  revalidatePath(`/campaigns/${campaign.slug}`);
  return "error" in result ? { error: resubmitError(result.error) } : {};
}

// While waiting for the beneficiary: send the SMS again, or to a new number.
export type BeneficiaryLinkState = { error?: string; sentAt?: number; editing?: boolean };

function sendLinkError(code: SendLinkError): string {
  switch (code) {
    case "invalid_phone":
      return "Enter a Kenyan mobile number starting with 07 or 01.";
    case "invalid_name":
      return "Enter their full name, as they’d recognise it.";
    case "invalid_relationship":
      return "How are they related to the child? e.g. Mother";
    case "own_phone":
      return "That’s your own number. Enter the number of the person you’re raising for.";
    case "beneficiary_has_viral_campaign":
      return "This person already has a viral harambee running. Only one is allowed at a time.";
    case "resend_too_soon":
      return "Please wait a minute before sending another SMS.";
    case "not_awaiting_beneficiary":
      return "This harambee isn’t waiting for confirmation any more. Refresh the page.";
    case "not-logged-in":
    case "not_organiser":
      return "Only the organiser can do this. Please log in again.";
    default:
      return "We couldn’t find this harambee. Refresh the page and try again.";
  }
}

export async function beneficiaryLinkAction(prev: BeneficiaryLinkState, formData: FormData): Promise<BeneficiaryLinkState> {
  const intent = formData.get("intent");
  if (intent === "edit") return { editing: true };
  if (intent === "cancel") return {};

  const campaign = await getCampaign(String(formData.get("slug") ?? ""));
  if (!campaign) return { ...prev, error: sendLinkError("campaign_not_found") };

  let name: string;
  let phone: string | null;
  let relationship: string | null;
  if (intent === "resend") {
    const link = await getBeneficiaryLink(campaign.id);
    if (!link) return { editing: true, error: "Enter their name and number to send the SMS." };
    ({ name, phone, relationship } = link);
  } else {
    const text = (key: string) => String(formData.get(key) ?? "").trim().replace(/\s+/g, " ");
    name = text("name");
    relationship = campaign.beneficiaryIsMinor ? text("relationship") : null;
    phone = normaliseKenyanPhone(String(formData.get("phone") ?? ""));
    if (!phone) return { editing: true, error: sendLinkError("invalid_phone") };
  }

  let result: Awaited<ReturnType<typeof sendBeneficiaryLink>>;
  try {
    result = await sendBeneficiaryLink(campaign, name, phone, relationship);
  } catch (error) {
    console.error("sendBeneficiaryLink failed:", error);
    return { ...prev, error: "We couldn’t send the SMS. Please try again in a minute." };
  }
  if ("error" in result) return { editing: intent !== "resend", error: sendLinkError(result.error) };
  revalidatePath(`/campaigns/${campaign.slug}`);
  return { sentAt: Date.now() };
}
