import "server-only";
import { getCurrentUser } from "@/lib/auth";
import type { Campaign } from "@/lib/campaigns";
import { smsLink } from "@/lib/site";
import { sendSms } from "@/lib/sms";
import { createClient } from "@/lib/supabase/server";
import { createSecretClient } from "@/lib/supabase/secret";

// Beneficiary confirmation (see supabase/beneficiary_verification.sql). The
// beneficiary has no account, so everything they do goes through the secret
// key, from the server only. The database creates and checks the tokens and
// codes and only ever stores them hashed.

// Our database functions raise plain exceptions (code P0001) whose message is the error code.
function knownError<T extends string>(error: { code?: string; message: string }, known: Set<string>): T | null {
  return error.code === "P0001" && known.has(error.message) ? (error.message as T) : null;
}

// The token in /confirm/[token]: 32 random bytes, URL-safe base64.
export function isLinkToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

// Organiser side -----------------------------------------------------------

export type BeneficiaryPhoneError = "invalid_phone" | "own_phone" | "beneficiary_has_viral_campaign";

const PHONE_ERRORS = new Set<string>(["invalid_phone", "own_phone", "beneficiary_has_viral_campaign"]);

// Checked before creating the campaign, so most problems show on the form.
// issue_beneficiary_link checks again.
export async function checkBeneficiaryPhone(userId: string, phone: string, viral: boolean): Promise<BeneficiaryPhoneError | null> {
  const { error } = await createSecretClient().rpc("check_beneficiary_phone", {
    p_user_id: userId,
    p_phone: phone,
    p_viral: viral,
  });
  if (!error) return null;
  const known = knownError<BeneficiaryPhoneError>(error, PHONE_ERRORS);
  if (known) return known;
  throw error;
}

export type SendLinkError =
  | BeneficiaryPhoneError
  | "not-logged-in"
  | "invalid_name"
  | "campaign_not_found"
  | "not_organiser"
  | "not_awaiting_beneficiary"
  | "resend_too_soon";

const SEND_ERRORS = new Set<string>([
  ...PHONE_ERRORS,
  "invalid_name",
  "campaign_not_found",
  "not_organiser",
  "not_awaiting_beneficiary",
  "resend_too_soon",
]);

// Texts the beneficiary a new link and code. Also resends, or sends to a new
// number: the old link stops working. phone must be in the +254 form.
export async function sendBeneficiaryLink(
  campaign: Pick<Campaign, "id" | "title" | "organiser">,
  name: string,
  phone: string,
): Promise<{ ok: true } | { error: SendLinkError }> {
  const user = await getCurrentUser();
  if (!user) return { error: "not-logged-in" };

  const { data, error } = await createSecretClient()
    .rpc("issue_beneficiary_link", { p_user_id: user.id, p_campaign_id: campaign.id, p_name: name, p_phone: phone })
    .single<{ token: string; code: string }>();
  if (error) {
    const known = knownError<SendLinkError>(error, SEND_ERRORS);
    if (known) return { error: known };
    throw error;
  }
  await sendSms(
    phone,
    `Sisi kwa Sisi: ${campaign.organiser} started a harambee for you, "${campaign.title}". ` +
      `To confirm it, open ${smsLink(`/confirm/${data.token}`)} and enter code ${data.code} (expires in 10 minutes). ` +
      `If it isn't you or you don't agree, open the link to tell us.`,
  );
  return { ok: true };
}

export type BeneficiaryLink = {
  name: string;
  phone: string;
  sentAt: string;
  linkExpiresAt: string;
  outcome: "confirmed" | "declined" | null;
};

// For the organiser and admins; null for everyone else, or before the first SMS.
export async function getBeneficiaryLink(campaignId: string): Promise<BeneficiaryLink | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("beneficiary_link_status", { p_campaign_id: campaignId }).maybeSingle<{
    name: string;
    phone: string;
    sent_at: string;
    link_expires_at: string;
    outcome: BeneficiaryLink["outcome"];
  }>();
  if (error) throw error;
  return data
    ? { name: data.name, phone: data.phone, sentAt: data.sent_at, linkExpiresAt: data.link_expires_at, outcome: data.outcome }
    : null;
}

// Texts the beneficiary when the story or goal of their confirmed harambee
// changes. The database queues a notice with every such edit, so this only
// sends when there's one waiting.
export async function notifyBeneficiaryOfEdit(campaign: Pick<Campaign, "id" | "slug">): Promise<void> {
  const { data: phone, error } = await createSecretClient().rpc("claim_beneficiary_edit_notice", {
    p_campaign_id: campaign.id,
  });
  if (error) throw error;
  if (!phone) return;
  await sendSms(
    phone as string,
    `Your harambee on Sisi kwa Sisi was edited. Check it here: ${smsLink(`/campaigns/${campaign.slug}`)}`,
  );
}

// Admin side ---------------------------------------------------------------

export type PayoutPhone = { phone: string; name: string; confirmedAt: string };

// Row-level security only returns payout numbers to admins.
export async function getPayoutPhone(campaignId: string): Promise<PayoutPhone | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payout_phones")
    .select("phone, name, confirmed_at")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return data ? { phone: data.phone, name: data.name, confirmedAt: data.confirmed_at } : null;
}

// Other campaigns paid out to the same number.
export async function getOtherCampaignIdsForPayoutPhone(phone: string, campaignId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payout_phones")
    .select("campaign_id")
    .eq("phone", phone)
    .neq("campaign_id", campaignId);
  if (error) throw error;
  return data.map((r) => r.campaign_id as string);
}

// Beneficiary side (the /confirm page) -------------------------------------

export type LinkStatus = "open" | "invalid" | "link_expired" | "confirmed" | "declined";

// All the page may show before the code is entered.
export async function getLinkTitle(token: string): Promise<{ status: LinkStatus; title: string | null }> {
  if (!isLinkToken(token)) return { status: "invalid", title: null };
  const { data, error } = await createSecretClient()
    .rpc("beneficiary_link_title", { p_token: token })
    .single<{ status: LinkStatus; title: string | null }>();
  if (error) throw error;
  return data;
}

export type CodeResult = "wrong_code" | "too_many_attempts" | "expired" | Exclude<LinkStatus, "open">;

export type HarambeeToConfirm = { name: string; title: string; story: string; goal: number; organiser: string; slug: string };

export async function checkBeneficiaryCode(
  token: string,
  code: string,
): Promise<{ ok: true; harambee: HarambeeToConfirm } | { error: CodeResult }> {
  if (!isLinkToken(token)) return { error: "invalid" };
  const { data, error } = await createSecretClient().rpc("beneficiary_check_code", { p_token: token, p_code: code });
  if (error) throw error;
  const { result, ...harambee } = data as { result: "ok" | CodeResult } & HarambeeToConfirm;
  return result === "ok" ? { ok: true, harambee } : { error: result };
}

export type ConfirmResult = "live" | "pending_approval" | CodeResult | "own_phone" | "beneficiary_has_viral_campaign";

export async function confirmAsBeneficiary(token: string, code: string): Promise<ConfirmResult> {
  if (!isLinkToken(token)) return "invalid";
  const { data, error } = await createSecretClient().rpc("beneficiary_confirm", { p_token: token, p_code: code });
  if (error) throw error;
  return data as ConfirmResult;
}

export async function declineAsBeneficiary(token: string): Promise<"declined" | Exclude<LinkStatus, "open" | "declined">> {
  if (!isLinkToken(token)) return "invalid";
  const { data, error } = await createSecretClient().rpc("beneficiary_decline", { p_token: token });
  if (error) throw error;
  return data;
}

export type ResendError = "resend_too_soon" | Exclude<LinkStatus, "open">;

const RESEND_ERRORS = new Set<string>(["resend_too_soon", "invalid", "link_expired", "confirmed", "declined"]);

// A new code for the same link.
export async function resendBeneficiaryCode(token: string): Promise<{ ok: true } | { error: ResendError }> {
  if (!isLinkToken(token)) return { error: "invalid" };
  const { data, error } = await createSecretClient()
    .rpc("resend_beneficiary_code", { p_token: token })
    .single<{ phone: string; code: string }>();
  if (error) {
    const known = knownError<ResendError>(error, RESEND_ERRORS);
    if (known) return { error: known };
    throw error;
  }
  await sendSms(data.phone, `Your Sisi kwa Sisi confirmation code is ${data.code}. It expires in 10 minutes. Don't share it with anyone.`);
  return { ok: true };
}
