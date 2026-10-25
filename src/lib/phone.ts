// Kenyan mobile numbers. People type 07… or 01…; we store +2547… or +2541…,
// matching the check in supabase/organiser_verification.sql.

// Returns the +254 form, or null if it isn't a Kenyan mobile number.
// Also accepts +254…, 254… and spaces or dashes.
export function normaliseKenyanPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("254") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : null;
  return local && /^[17][0-9]{8}$/.test(local) ? `+254${local}` : null;
}

// +254712345678 → 0712 345 678, how people write it.
export function formatKenyanPhone(phone: string): string {
  const local = `0${phone.slice(4)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

export const PHONE_CODE_LENGTH = 6;
export const PHONE_CODE_RESEND_SECONDS = 60; // the database refuses to send more often
