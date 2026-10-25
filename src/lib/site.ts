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

// Absolute URL for links we send by SMS. Comes from SITE_URL, never from the
// request: the Host header can be faked, which would put the real code in a
// message pointing at someone else's site.
export function smsLink(path: string): string {
  const base = process.env.SITE_URL;
  if (base) return `${base.replace(/\/+$/, "")}${path}`;
  if (process.env.NODE_ENV !== "production") return `http://localhost:3000${path}`;
  throw new Error("Missing SITE_URL. Add it to the environment, e.g. SITE_URL=https://sisikwasisi.co.ke");
}
