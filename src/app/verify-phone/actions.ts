"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth";
import { normaliseKenyanPhone } from "@/lib/phone";
import { sendPhoneCode, verifyPhoneCode, type SendCodeError, type VerifyResult } from "@/lib/verification";

// One action for both steps, so they share state: "send" and "resend" text a
// code, "verify" checks it, "change" goes back to entering a number.
export type VerifyPhoneState = {
  step: "phone" | "code";
  phone?: string; // +254…, once a code has been sent
  typed?: string; // what was typed, kept after an error
  sentAt?: number; // starts the resend countdown
  error?: string;
};

function sendError(code: SendCodeError | "not-logged-in"): string {
  switch (code) {
    case "invalid_phone":
      return "Enter a Kenyan mobile number starting with 07 or 01.";
    case "phone_taken":
      return "This number is already verified on another account.";
    case "resend_too_soon":
      return "Please wait a minute before asking for another code.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the link.";
    default:
      return "You’ve been logged out. Please log in again.";
  }
}

function verifyError(result: Exclude<VerifyResult, "verified"> | "not-logged-in"): string {
  switch (result) {
    case "wrong_code":
      return "That code isn’t right. Check the SMS and try again.";
    case "too_many_attempts":
      return "Too many wrong tries. Send a new code.";
    case "expired":
      return "This code has expired. Send a new code.";
    case "no_code":
      return "Send a code first.";
    case "phone_taken":
      return "This number was just verified on another account. Try a different number.";
    default:
      return "You’ve been logged out. Please log in again.";
  }
}

export async function verifyPhoneAction(prev: VerifyPhoneState, formData: FormData): Promise<VerifyPhoneState> {
  const intent = formData.get("intent");
  const next = safeNext(formData.get("next"), "/campaigns/new");

  if (intent === "change") return { step: "phone", typed: prev.phone ? `0${prev.phone.slice(4)}` : prev.typed };

  if (intent === "send" || intent === "resend") {
    const typed = String(formData.get("phone") ?? "").trim();
    const phone = intent === "resend" ? prev.phone : normaliseKenyanPhone(typed);
    if (!phone) return { step: "phone", typed, error: sendError("invalid_phone") };

    let result: Awaited<ReturnType<typeof sendPhoneCode>>;
    try {
      result = await sendPhoneCode(phone);
    } catch (error) {
      console.error("sendPhoneCode failed:", error);
      return { ...prev, error: "We couldn’t send the code. Please try again in a minute." };
    }
    if ("error" in result) {
      // Already verified on this account, so nothing more to do.
      if (result.error === "already_verified") redirect(next);
      // A code went to this number less than a minute ago: let them enter it.
      if (result.error === "resend_too_soon" && prev.phone === phone) return { ...prev, error: sendError(result.error) };
      return { step: "phone", typed, error: sendError(result.error) };
    }
    return { step: "code", phone, sentAt: Date.now() };
  }

  if (intent === "verify") {
    const code = String(formData.get("code") ?? "").replace(/\s/g, "");
    if (!/^[0-9]{6}$/.test(code)) return { ...prev, error: "Enter the 6-digit code from the SMS." };
    const result = await verifyPhoneCode(code);
    if (result === "verified") redirect(next);
    return { ...prev, error: verifyError(result) };
  }

  return prev;
}
