import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; name: string; email: string; emailConfirmed: boolean };

// The logged-in user, or null. Cached so the header and page share one lookup per request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = user.email ?? "";
  const name = String(user.user_metadata?.full_name ?? "").trim() || email.split("@")[0];
  return { id: user.id, name, email, emailConfirmed: Boolean(user.email_confirmed_at) };
});

// Only allow redirects to our own pages, never to another site.
export function safeNext(next: unknown, fallback = "/campaigns"): string {
  const path = typeof next === "string" ? next : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

// The email someone just signed up with, so /check-email can show it and resend
// the link. Kept in a cookie rather than the URL so it doesn't end up in logs.
const PENDING_EMAIL_COOKIE = "sks_pending_email";

export async function rememberPendingEmail(email: string) {
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, { ...cookieOptions, maxAge: 60 * 60 * 24 });
}

export async function getPendingEmail(): Promise<string | undefined> {
  return (await cookies()).get(PENDING_EMAIL_COOKIE)?.value;
}

// Set when a password reset link is opened, so /reset-password only works
// straight after following that link, not for anyone who happens to be logged in.
const RESET_COOKIE = "sks_password_reset";

export async function allowPasswordReset(userId: string) {
  (await cookies()).set(RESET_COOKIE, userId, { ...cookieOptions, maxAge: 60 * 30 });
}

export async function canResetPassword(userId: string): Promise<boolean> {
  return (await cookies()).get(RESET_COOKIE)?.value === userId;
}

export async function endPasswordReset() {
  (await cookies()).delete(RESET_COOKIE);
}
