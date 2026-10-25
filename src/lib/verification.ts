import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { sendSms } from "@/lib/sms";
import { createClient } from "@/lib/supabase/server";
import { createSecretClient } from "@/lib/supabase/secret";

// Organiser phone verification (see supabase/organiser_verification.sql). The
// database creates and checks the codes and only ever stores them hashed.

// The logged-in user's verified number (+254…), or null. Row-level security
// only returns the user's own number (admins can read everyone's).
export async function getVerifiedPhone(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organiser_phones")
    .select("phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.phone ?? null;
}

// For admins: the verified numbers of these organisers, by user id.
export async function getVerifiedPhones(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.from("organiser_phones").select("user_id, phone").in("user_id", userIds);
  if (error) throw error;
  return new Map(data.map((r) => [r.user_id as string, r.phone as string]));
}

export type SendCodeError =
  | "not-logged-in"
  | "email_not_confirmed"
  | "invalid_phone"
  | "already_verified"
  | "phone_taken"
  | "resend_too_soon";

const SEND_ERRORS = new Set<string>(["email_not_confirmed", "invalid_phone", "already_verified", "phone_taken", "resend_too_soon"]);

// phone must already be in the +254 form (see src/lib/phone.ts).
export async function sendPhoneCode(phone: string): Promise<{ ok: true } | { error: SendCodeError }> {
  const user = await getCurrentUser();
  if (!user) return { error: "not-logged-in" };

  // Only the secret key can issue a code, so it can't be fetched from the browser.
  const { data: code, error } = await createSecretClient().rpc("issue_phone_code", {
    p_user_id: user.id,
    p_phone: phone,
  });
  if (error) {
    // Our database functions raise plain exceptions (code P0001) whose message is the error code.
    if (error.code === "P0001" && SEND_ERRORS.has(error.message)) return { error: error.message as SendCodeError };
    throw error;
  }
  await sendSms(phone, `Your Sisi kwa Sisi code is ${code}. It expires in 10 minutes. Don't share it with anyone.`);
  return { ok: true };
}

export type VerifyResult = "verified" | "wrong_code" | "too_many_attempts" | "expired" | "no_code" | "phone_taken";

export async function verifyPhoneCode(code: string): Promise<VerifyResult | "not-logged-in"> {
  if (!(await getCurrentUser())) return "not-logged-in";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_phone_code", { p_code: code });
  if (error) {
    if (error.code === "P0001" && error.message === "not_logged_in") return "not-logged-in";
    throw error;
  }
  return data as VerifyResult;
}
