import { formatKES, formatTimeLeft, percentRaised } from "@/lib/format";

// Builds the progress update people paste into WhatsApp groups. Kept generic
// (no Campaign type) so challenges can reuse the same format later.

export const SUMMARY_DONOR_LIMIT = 20;

export type WhatsAppSummary = {
  title: string;
  raised: number;
  goal: number | null; // null: no goal to measure against (a challenge without a target)
  donorCount: number;
  donors: { name: string | null; amount: number }[]; // newest first; null = anonymous
  url: string;
};

// WhatsApp treats * _ ~ ` as formatting marks, so strip them from user text
// that sits inside (or next to) our own bold markers.
function plain(text: string): string {
  return text.replace(/[*_~`]/g, "").trim();
}

export function buildWhatsAppSummary({
  title,
  raised,
  goal,
  donorCount,
  donors,
  url,
}: WhatsAppSummary): string {
  const shown = donors.slice(0, SUMMARY_DONOR_LIMIT);
  const more = Math.max(donorCount, donors.length) - shown.length;

  const lines = [
    `*${plain(title)}*`,
    goal === null
      ? `*${formatKES(raised)} raised*`
      : `*${formatKES(raised)} raised of ${formatKES(goal)} (${percentRaised(raised, goal)}%)*`,
    `${donorCount.toLocaleString("en-KE")} ${donorCount === 1 ? "donor" : "donors"}`,
    "",
  ];

  if (shown.length === 0) {
    lines.push("No donations yet. Be the first to give!");
  } else {
    shown.forEach((d, i) => {
      lines.push(`${i + 1}. ${d.name ? plain(d.name) : "Anonymous"} – ${formatKES(d.amount)}`);
    });
    if (more > 0) lines.push(`+ ${more.toLocaleString("en-KE")} more`);
  }

  lines.push("", `Give and share: ${url}`);
  return lines.join("\n");
}

export type ChallengeInvite = {
  hostName: string;
  campaignTitle: string;
  mgeniRasmi: boolean;
  challengeName: string; // e.g. "KSh 100 Challenge"
  preset: number | null; // KSh 100 / KSh 50 challenges
  hostGift: number | null; // Mgeni Rasmi: what the host gave
  raised: number;
  target: number | null;
  msLeft: number;
  url: string;
};

// The short invite behind the challenge's "Share to WhatsApp" button.
// Mgeni Rasmi invites end with "Nisindikize! 🙌" just before the link.
export function buildChallengeInvite(c: ChallengeInvite): string {
  const host = plain(c.hostName);
  const campaign = plain(c.campaignTitle);
  const total = c.target !== null ? `${formatKES(c.raised)} of ${formatKES(c.target)}` : formatKES(c.raised);

  const lines = c.mgeniRasmi
    ? [
        `🎉 *${host} is Mgeni Rasmi* for *${campaign}*`,
        `${host} gave ${formatKES(c.hostGift ?? 0)} to start. Raised so far: ${total}.`,
        `⏳ ${formatTimeLeft(c.msLeft)} left`,
        "",
        "Nisindikize! 🙌",
      ]
    : [
        `*${host}’s ${c.challengeName}* for *${campaign}*`,
        `Raised so far: ${total}.${c.preset ? ` Give ${formatKES(c.preset)} or more.` : ""}`,
        `⏳ ${formatTimeLeft(c.msLeft)} left`,
        "",
      ];

  return [...lines, c.url].join("\n");
}
