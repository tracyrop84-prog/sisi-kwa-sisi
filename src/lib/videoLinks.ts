import type { Category } from "@/lib/categories";

// Links to the original video on viral campaigns. Keep in sync with
// campaigns_viral_video_url_check in supabase/beneficiary_verification.sql.

// Only these campaigns can link a viral video.
export const VIRAL_CATEGORY = "Business & Empowerment" satisfies Category;

const PLATFORMS = [
  { name: "TikTok", hosts: ["tiktok.com"], subdomains: true },
  { name: "Facebook", hosts: ["facebook.com"], subdomains: true },
  { name: "Facebook", hosts: ["fb.watch"], subdomains: false },
  { name: "Instagram", hosts: ["instagram.com"], subdomains: true },
  { name: "YouTube", hosts: ["youtube.com"], subdomains: true },
  { name: "YouTube", hosts: ["youtu.be"], subdomains: false },
] as const;

export const MAX_VIDEO_URL = 500;

function platformOf(host: string): string | null {
  for (const p of PLATFORMS) {
    for (const h of p.hosts) {
      if (host === h) return p.name;
      // One level only, e.g. www., m. or vm., like the database check.
      if (p.subdomains && host.endsWith(`.${h}`) && /^[a-z0-9-]+$/.test(host.slice(0, -(h.length + 1)))) {
        return p.name;
      }
    }
  }
  return null;
}

// The link in the form the database accepts (https, no login or port, a path
// to the video), or null if it isn't a TikTok, Facebook, Instagram or YouTube link.
// People often paste without https://, so that's added.
export function normaliseVideoUrl(input: string): string | null {
  const typed = input.trim();
  if (!typed || /\s/.test(typed)) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(typed) ? typed : `https://${typed}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  if (!platformOf(url.hostname) || url.pathname === "/") return null;
  url.protocol = "https:";
  url.hash = "";
  const href = url.href;
  return href.length <= MAX_VIDEO_URL ? href : null;
}

// "TikTok", "Facebook", "Instagram" or "YouTube", for the link card.
export function videoPlatform(url: string): string {
  try {
    return platformOf(new URL(url).hostname) ?? "the original";
  } catch {
    return "the original";
  }
}
