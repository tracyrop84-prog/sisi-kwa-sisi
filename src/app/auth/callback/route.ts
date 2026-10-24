import { isAuthPKCECodeVerifierMissingError, type EmailOtpType, type User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { allowPasswordReset, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<string>(["signup", "email", "recovery"]);

// Links in the sign-up confirmation and password reset emails land here.
// Swap the link's one-time token for a login session, then send the user on.
//
// Two kinds of link arrive:
// - ?code=… from Supabase's default emails ({{ .ConfirmationURL }}). Supabase has
//   already confirmed the email (or approved the reset) before sending people here.
//   Swapping the code for a session only works in the browser that signed up or
//   asked for the reset, because it needs a secret Supabase left in that browser's cookies.
// - ?token_hash=…&type=… from custom email templates (needs custom SMTP).
//   Works in any browser, which matters when someone signs up in WhatsApp's
//   browser and opens Gmail later.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "";
  // Our reset emails link here with next=/reset-password (see forgotPasswordAction).
  const next = type === "recovery" ? "/reset-password" : safeNext(searchParams.get("next"));

  const supabase = await createClient();
  let user: User | null = null;
  let otherBrowser = false;
  if (tokenHash && OTP_TYPES.has(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (!error) user = data.user;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) user = data.user;
    otherBrowser = isAuthPKCECodeVerifierMissingError(error);
  }

  const resetting = next === "/reset-password";
  if (user) {
    if (resetting) await allowPasswordReset(user.id);
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (resetting) {
    return NextResponse.redirect(`${origin}/forgot-password?error=${otherBrowser ? "browser" : "link"}`);
  }
  // Supabase only hands out a code after confirming the email, so even if we
  // couldn't log them in here (another browser, or the link was opened twice),
  // their account is confirmed and they just need to log in.
  const nextQuery = next === "/campaigns" ? "" : `&next=${encodeURIComponent(next)}`;
  if (code) return NextResponse.redirect(`${origin}/login?confirmed=1${nextQuery}`);
  return NextResponse.redirect(`${origin}/login?error=link${nextQuery}`);
}
