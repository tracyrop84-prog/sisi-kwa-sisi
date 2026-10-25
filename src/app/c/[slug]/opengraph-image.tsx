import { ImageResponse } from "next/og";
import { getCampaignById } from "@/lib/campaigns";
import { CHALLENGE_TYPES, challengeState, challengeTitle, getChallenge } from "@/lib/challenges";
import { formatKES, formatTimeLeft } from "@/lib/format";
import { clip, loadCoverPhoto, loadOgFonts, OG_COLORS, OG_SIZE } from "@/lib/og";

// The preview card WhatsApp, Facebook and X show when a challenge link is shared.
// When the campaign has a cover photo, it fills the right-hand side.

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A Sisi kwa Sisi challenge";

const COLORS = OG_COLORS;

export default async function Image({ params }: { params: { slug: string } }) {
  const challenge = await getChallenge(params.slug);
  const campaign = challenge && (await getCampaignById(challenge.campaignId));
  const [fonts, cover] = await Promise.all([loadOgFonts(), loadCoverPhoto(campaign?.coverPhoto ?? null)]);

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

  // With a cover photo the text column is narrower, so titles are clipped shorter.
  const wide = !cover;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: COLORS.background }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            height: "100%",
            padding: wide ? 64 : 56,
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
              {wide ? `${type.name} · ${type.tagline}` : type.name}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
            <div style={{ fontSize: wide ? 76 : 60, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>
              {clip(challengeTitle(challenge), wide ? 32 : 26)}
            </div>
            <div style={{ marginTop: 18, fontSize: wide ? 36 : 30, fontWeight: 500, color: COLORS.muted }}>
              {`for ${clip(campaign.title, wide ? 52 : 40)}`}
            </div>
            <div style={{ marginTop: 10, fontSize: wide ? 30 : 26, fontWeight: 500, color: COLORS.muted }}>
              {`Hosted by ${clip(challenge.hostName, wide ? 40 : 30)}`}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <div style={{ fontSize: wide ? 60 : 48, fontWeight: 800 }}>{formatKES(challenge.raised)}</div>
                {wide && <div style={{ fontSize: 30, fontWeight: 500, color: COLORS.muted }}>{raisedNote}</div>}
              </div>
              <div style={{ fontSize: wide ? 32 : 26, fontWeight: 800, color: state === "live" ? COLORS.accent : COLORS.muted }}>
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
        {cover && (
          <img src={cover} alt="" width={420} height={630} style={{ width: 420, height: 630, objectFit: "cover" }} />
        )}
      </div>
    ),
    { ...size, fonts },
  );
}
