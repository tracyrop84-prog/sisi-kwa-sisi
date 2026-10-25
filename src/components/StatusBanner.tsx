import type { Campaign } from "@/lib/campaigns";
import { formatKES } from "@/lib/format";

type Props = { campaign: Pick<Campaign, "status" | "raised" | "donorCount"> };

// Shown on a paused, closed or completed campaign and its challenges. Review
// notices use the soft blue with an info icon; an ended harambee gets a warm thank-you.
export default function StatusBanner({ campaign }: Props) {
  if (campaign.status === "active") return null;

  if (campaign.status === "completed") {
    return (
      <div role="status" className="mt-2 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <p className="font-bold">This harambee has ended. Thank you to everyone who gave 🙏</p>
        <p className="mt-1 text-sm text-muted">
          Final total: <span className="font-semibold text-text">{formatKES(campaign.raised)}</span> from{" "}
          {campaign.donorCount.toLocaleString("en-KE")} {campaign.donorCount === 1 ? "donor" : "donors"}
        </p>
      </div>
    );
  }

  return (
    <div role="status" className="mt-2 flex items-start gap-3 rounded-2xl bg-accent/10 p-4">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="6.2" r="1" fill="currentColor" />
      </svg>
      {campaign.status === "paused" ? (
        <div>
          <p className="font-bold">Donations are paused while we review this harambee</p>
          <p className="mt-1 text-sm text-muted">Donations already made are still recorded.</p>
        </div>
      ) : (
        <div>
          <p className="font-bold">This harambee has been closed</p>
          <p className="mt-1 text-sm text-muted">
            It no longer takes donations. Everyone who gave will be refunded.
          </p>
        </div>
      )}
    </div>
  );
}
