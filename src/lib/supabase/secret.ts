import "server-only";
import { createClient } from "@supabase/supabase-js";

// Supabase client with the secret key (sb_secret_…), which bypasses row-level
// security. Only for the few database functions granted to service_role (see
// supabase/organiser_verification.sql), never for reading or writing tables.
// SUPABASE_SECRET_KEY must never get a NEXT_PUBLIC_ prefix, or it would be
// sent to every browser.
export function createSecretClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase secret key. Add SUPABASE_SECRET_KEY to .env.local (Dashboard → Project Settings → API Keys → Secret keys), then restart the dev server.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
