import "server-only";
import { photoUrl } from "@/lib/photos";

// Shared by the Open Graph preview cards (campaigns and challenges) that
// WhatsApp, Facebook and X show when a link is shared.

export const OG_SIZE = { width: 1200, height: 630 };

export const OG_COLORS = {
  primary: "#C1121F",
  accent: "#1D4ED8",
  text: "#1F1F1F",
  muted: "#555555",
  background: "#FAFAF7",
};

// Plus Jakarta Sans from Google Fonts (TTF, which the image renderer needs).
// If Google can't be reached, the card still renders in the built-in font.
async function loadFont(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@${weight}`, {
      cache: "force-cache",
    }).then((r) => r.text());
    const src = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!src) return null;
    return await fetch(src, { cache: "force-cache" }).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export async function loadOgFonts() {
  const [medium, bold] = await Promise.all([loadFont(500), loadFont(800)]);
  return [
    ...(medium ? [{ name: "Jakarta", data: medium, weight: 500 as const }] : []),
    ...(bold ? [{ name: "Jakarta", data: bold, weight: 800 as const }] : []),
  ];
}

// The cover photo as a data URL. Fetched here rather than by the renderer so a
// missing or slow photo just leaves it out instead of breaking the whole card.
export async function loadCoverPhoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const res = await fetch(photoUrl(path), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:image/jpeg;base64,${data}`;
  } catch {
    return null;
  }
}

export const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
