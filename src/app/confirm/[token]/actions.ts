"use server";

import {
  checkBeneficiaryCode,
  confirmAsBeneficiary,
  declineAsBeneficiary,
  resendBeneficiaryCode,
  type HarambeeToConfirm,
} from "@/lib/beneficiaries";
import { BENEFICIARY_LINK_DAYS } from "@/lib/campaignRules";

// The beneficiary's side of the confirmation. They have no account: the token
// in the link and the code from the SMS are all there is, and the database
// checks both. One action for every step, so they share state:
// - "verify" checks the code and shows the harambee
// - "confirm" agrees (the code is checked again), "decline" asks "are you sure?"
//   and "decline-yes" closes the harambee
// - "resend" texts a new code, "back" returns to the previous step
export type ConfirmState = {
  step: "code" | "review" | "decline" | "done";
  code?: string; // kept after it was right, for "confirm"
  harambee?: HarambeeToConfirm; // only once the code was right
  outcome?: "live" | "pending_approval" | "declined" | "ended";
  ended?: string; // why the link can't be used any more
  sentAt?: number; // starts the resend countdown
  error?: string;
};

// Results that mean this link is finished, whatever step we're on.
function endedMessage(result: string): string | null {
  switch (result) {
    case "invalid":
      return "This link no longer works. If the organiser sent you a newer SMS, use the link in that one.";
    case "link_expired":
      return `This link has expired (links work for ${BENEFICIARY_LINK_DAYS} days). Ask the organiser to send you a new one.`;
    case "confirmed":
      return "You’ve already confirmed this harambee. Thank you!";
    case "declined":
      return "You’ve already told us this harambee isn’t yours, so it has been closed.";
    default:
      return null;
  }
}

function codeError(result: string): string {
  switch (result) {
    case "wrong_code":
      return "That code isn’t right. Check the SMS and try again.";
    case "too_many_attempts":
      return "Too many wrong tries. Send a new code.";
    case "expired":
      return "This code has expired. Send a new code.";
    case "own_phone":
      return "This number belongs to the organiser, so it can’t be used to confirm the harambee.";
    case "beneficiary_has_viral_campaign":
      return "You already have a viral harambee running on Sisi kwa Sisi, and only one is allowed at a time, so this one can’t go live.";
    case "resend_too_soon":
      return "Please wait a minute before asking for another code.";
    default:
      return "Something went wrong. Please try again.";
  }
}

const ended = (message: string): ConfirmState => ({ step: "done", outcome: "ended", ended: message });

export async function confirmAction(prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const intent = formData.get("intent");
  // From the page's URL. It's only a lookup key: the database decides what it allows.
  const token = String(formData.get("token") ?? "");

  try {
    if (intent === "back") return prev.harambee ? { ...prev, step: "review", error: undefined } : { step: "code" };
    if (intent === "decline") return { ...prev, step: "decline", error: undefined };

    if (intent === "resend") {
      const result = await resendBeneficiaryCode(token);
      if ("error" in result) {
        const message = endedMessage(result.error);
        return message ? ended(message) : { ...prev, error: codeError(result.error) };
      }
      // A new code: enter it again before seeing the harambee.
      return { step: "code", sentAt: Date.now() };
    }

    if (intent === "verify") {
      const code = String(formData.get("code") ?? "").replace(/\s/g, "");
      if (!/^[0-9]{6}$/.test(code)) return { ...prev, error: "Enter the 6-digit code from the SMS." };
      const result = await checkBeneficiaryCode(token, code);
      if ("error" in result) {
        const message = endedMessage(result.error);
        return message ? ended(message) : { ...prev, error: codeError(result.error) };
      }
      return { step: "review", code, harambee: result.harambee };
    }

    if (intent === "confirm") {
      if (!prev.code || !prev.harambee) return { step: "code" };
      if (formData.get("agree") !== "on") return { ...prev, error: "Please tick the box to agree." };
      const result = await confirmAsBeneficiary(token, prev.code);
      if (result === "live" || result === "pending_approval") return { ...prev, step: "done", outcome: result, error: undefined };
      const message = endedMessage(result);
      if (message) return ended(message);
      // The code has expired or was used up meanwhile: start again with a new one.
      if (result === "expired" || result === "too_many_attempts") return { step: "code", error: codeError(result) };
      return { ...prev, error: codeError(result) };
    }

    if (intent === "decline-yes") {
      const result = await declineAsBeneficiary(token);
      if (result === "declined") return { step: "done", outcome: "declined" };
      return ended(endedMessage(result)!);
    }
  } catch (error) {
    console.error("confirmAction failed:", error);
    return { ...prev, error: "Something went wrong on our side. Please try again in a minute." };
  }

  return prev;
}
