import "server-only";
import { isAuthRetryableFetchError, isAuthWeakPasswordError, type AuthError } from "@supabase/supabase-js";

export type FriendlyError = {
  message: string;
  field?: "email" | "password"; // show it under that field instead of at the top
  linkExpired?: boolean; // the email link or reset session is no longer valid
};

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
const EXPIRED = "This link has expired or was already used. Please request a new one.";

// Turns a Supabase Auth error into a message people can act on.
// Codes: https://supabase.com/docs/guides/auth/debugging/error-codes
export function friendlyAuthError(error: AuthError): FriendlyError {
  if (isAuthWeakPasswordError(error)) {
    return error.reasons.includes("pwned")
      ? { field: "password", message: "This password has appeared in a data leak on another site. Choose a different one." }
      : { field: "password", message: "Use at least 8 characters, with at least one letter and one number." };
  }
  if (isAuthRetryableFetchError(error) || error.code === "request_timeout") {
    return { message: "We couldn’t connect just now. Please try again in a moment." };
  }
  if (error.status === 429) return { message: TOO_MANY };

  switch (error.code) {
    case "invalid_credentials":
      return { message: "That email and password don’t match. Check them and try again, or reset your password." };
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return { message: TOO_MANY };
    case "same_password":
      return { field: "password", message: "That’s your current password. Choose a new one." };
    case "email_address_invalid":
      return { field: "email", message: "We can’t send email to that address. Check it, or use a different email." };
    case "email_address_not_authorized":
      return { message: "We can’t send email to that address right now. Please try again later." };
    case "signup_disabled":
    case "email_provider_disabled":
      return { message: "New accounts are paused right now. Please try again later." };
    case "user_banned":
      return { message: "This account has been suspended." };
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
    case "reauthentication_needed":
      return { message: EXPIRED, linkExpired: true };
    default:
      console.error("Unexpected Supabase Auth error:", error.code, error.status, error.message);
      return { message: "Something went wrong. Please try again." };
  }
}
