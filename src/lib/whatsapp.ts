import { formatKES, percentRaised } from "@/lib/format";

// Builds the progress update people paste into WhatsApp groups. Kept generic
// (no Campaign type) so challenges can reuse the same format later.

export const SUMMARY_DONOR_LIMIT = 20;

export type WhatsAppSummary = {
  title: string;
  raised: number;
  goal: number;
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
    `*${formatKES(raised)} raised of ${formatKES(goal)} (${percentRaised(raised, goal)}%)*`,
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
