import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; name: string; email: string };

// The logged-in user, or null. Cached so the header and page share one lookup per request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = user.email ?? "";
  const name = String(user.user_metadata?.full_name ?? "").trim() || email.split("@")[0];
  return { id: user.id, name, email };
});

// Only allow redirects to our own pages, never to another site.
export function safeNext(next: unknown, fallback = "/campaigns"): string {
  const path = typeof next === "string" ? next : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}
