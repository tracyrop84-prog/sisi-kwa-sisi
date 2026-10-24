import { ImageResponse } from "next/og";
import { getCampaignById } from "@/lib/campaigns";
import { CHALLENGE_TYPES, challengeState, challengeTitle, getChallenge } from "@/lib/challenges";
import { formatKES, formatTimeLeft } from "@/lib/format";

// The preview card WhatsApp, Facebook and X show when a challenge link is shared.
// Campaign photos come in a later phase; for now it's a generated card.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A Sisi kwa Sisi challenge";

const COLORS = {
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

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export default async function Image({ params }: { params: { slug: string } }) {
  const challenge = await getChallenge(params.slug);
  const campaign = challenge && (await getCampaignById(challenge.campaignId));
  const [medium, bold] = await Promise.all([loadFont(500), loadFont(800)]);
  const fonts = [
    ...(medium ? [{ name: "Jakarta", data: medium, weight: 500 as const }] : []),
    ...(bold ? [{ name: "Jakarta", data: bold, weight: 800 as const }] : []),
  ];

  if (!challenge || !campaign) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: COLORS.background, color: COLORS.text, fontSize: 64, fontWeight: 800, fontFamily: "Jakarta" }}>
          Sisi kwa Sisi
        </div>
      ),
      { ...size, fonts },
    );
  }

  const now = Date.now();
  const state = challengeState(challenge, now);
  const type = CHALLENGE_TYPES[challenge.type];

  const status =
    state === "live"
      ? `${formatTimeLeft(new Date(challenge.endsAt!).getTime() - now)} left`
      : state === "pending"
        ? "Waiting for approval"
        : state === "waiting-for-host"
          ? "Starting soon"
          : "Ended";

  // Same rule as the page: own target if set, otherwise the campaign bar with this challenge's share.
  const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, (part / whole) * 100) : 0);
  const share = challenge.target !== null ? pct(challenge.raised, challenge.target) : pct(challenge.raised, campaign.goal);
  const rest = challenge.target !== null ? 0 : Math.max(0, pct(campaign.raised, campaign.goal) - share);
  const raisedNote =
    challenge.target !== null ? `raised of ${formatKES(challenge.target)} target` : "raised by this challenge";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: 64,
          background: COLORS.background,
          color: COLORS.text,
          fontFamily: "Jakarta",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 32, fontWeight: 800 }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: COLORS.primary }} />
            Sisi kwa Sisi
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 22px",
              borderRadius: 999,
              background: "rgba(29, 78, 216, 0.1)",
              color: COLORS.accent,
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            {type.name} · {type.tagline}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>
            {clip(challengeTitle(challenge), 32)}
          </div>
          <div style={{ marginTop: 18, fontSize: 36, fontWeight: 500, color: COLORS.muted }}>
            {`for ${clip(campaign.title, 52)}`}
          </div>
          <div style={{ marginTop: 10, fontSize: 30, fontWeight: 500, color: COLORS.muted }}>
            {`Hosted by ${clip(challenge.hostName, 40)}`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <div style={{ fontSize: 60, fontWeight: 800 }}>{formatKES(challenge.raised)}</div>
              <div style={{ fontSize: 30, fontWeight: 500, color: COLORS.muted }}>{raisedNote}</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: state === "live" ? COLORS.accent : COLORS.muted }}>
              {status}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              height: 26,
              width: "100%",
              borderRadius: 13,
              overflow: "hidden",
              background: "rgba(29, 78, 216, 0.15)",
            }}
          >
            <div style={{ width: `${share}%`, height: "100%", background: COLORS.accent }} />
            <div style={{ width: `${rest}%`, height: "100%", background: "rgba(29, 78, 216, 0.35)" }} />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
