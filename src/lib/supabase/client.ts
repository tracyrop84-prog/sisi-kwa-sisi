import { createBrowserClient } from "@supabase/ssr";

// Supabase client for client components (used for Realtime). Only the public
// anon key is used here; row-level security protects the data.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
