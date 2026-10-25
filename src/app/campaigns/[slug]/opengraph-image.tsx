import { ImageResponse } from "next/og";
import { getCampaign } from "@/lib/campaigns";
import { formatKES, percentRaised } from "@/lib/format";
import { clip, loadCoverPhoto, loadOgFonts, OG_COLORS as COLORS, OG_SIZE } from "@/lib/og";

// The preview card WhatsApp, Facebook and X show when a campaign link is shared.
// When the campaign has a cover photo, it fills the right-hand side.

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A Sisi kwa Sisi harambee";

export default async function Image({ params }: { params: { slug: string } }) {
  const campaign = await getCampaign(params.slug);
  const [fonts, cover] = await Promise.all([loadOgFonts(), loadCoverPhoto(campaign?.coverPhoto ?? null)]);

  if (!campaign) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: COLORS.background, color: COLORS.text, fontSize: 64, fontWeight: 800, fontFamily: "Jakarta" }}>
          Sisi kwa Sisi
        </div>
      ),
      { ...size, fonts },
    );
  }

  // With a cover photo the text column is narrower, so the title is clipped shorter.
  const wide = !cover;
  const percent = percentRaised(campaign.raised, campaign.goal);
  const donors = `${campaign.donorCount.toLocaleString("en-KE")} ${campaign.donorCount === 1 ? "donor" : "donors"}`;

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
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 32, fontWeight: 800 }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: COLORS.primary }} />
            Sisi kwa Sisi
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.accent, textTransform: "uppercase", letterSpacing: 1 }}>
              {`${campaign.category} · ${clip(campaign.location, 24)}`}
            </div>
            <div style={{ marginTop: 14, fontSize: wide ? 72 : 58, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>
              {clip(campaign.title, wide ? 60 : 44)}
            </div>
            <div style={{ marginTop: 16, fontSize: wide ? 30 : 26, fontWeight: 500, color: COLORS.muted }}>
              {`Organised by ${clip(campaign.organiser, 36)}`}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <div style={{ fontSize: wide ? 60 : 48, fontWeight: 800 }}>{formatKES(campaign.raised)}</div>
              <div style={{ fontSize: wide ? 30 : 26, fontWeight: 500, color: COLORS.muted }}>
                {`raised of ${formatKES(campaign.goal)}`}
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
              <div style={{ width: `${percent}%`, height: "100%", background: COLORS.accent }} />
            </div>
            <div style={{ marginTop: 14, fontSize: 26, fontWeight: 500, color: COLORS.muted }}>
              {`${percent}% · ${donors}`}
            </div>
          </div>
        </div>
        {cover && (
          <img src={cover} alt="" width={460} height={630} style={{ width: 460, height: 630, objectFit: "cover" }} />
        )}
      </div>
    ),
    { ...size, fonts },
  );
}
