import "server-only";
import { headers } from "next/headers";

// Absolute site URL for links shared outside the app (e.g. WhatsApp).
// Uses the request's own host, so it works on localhost, previews and production.
export async function siteUrl(path = ""): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}
