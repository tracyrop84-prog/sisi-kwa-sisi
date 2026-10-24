import ProgressBar from "@/components/ProgressBar";
import { formatKES } from "@/lib/format";

type Props = {
  raised: number; // by this challenge
  donorCount: number;
  target: number | null;
  campaign: { raised: number; goal: number };
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, (part / whole) * 100) : 0);

// With a target: a bar toward the challenge's own target. Without one: the
// campaign's bar, with this challenge's share highlighted.
export default function ChallengeProgress({ raised, donorCount, target, campaign }: Props) {
  if (target !== null) {
    return <ProgressBar raised={raised} goal={target} donorCount={donorCount} size="lg" />;
  }

  const share = pct(raised, campaign.goal);
  const rest = Math.max(0, pct(campaign.raised, campaign.goal) - share);

  return (
    <div>
      <p className="text-2xl font-extrabold">
        <span className="whitespace-nowrap">{formatKES(raised)}</span>{" "}
        <span className="text-base font-medium text-muted">raised by this challenge</span>
      </p>
      <div
        className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-accent/15"
        role="img"
        aria-label={`This challenge raised ${formatKES(raised)} of the ${formatKES(campaign.raised)} raised so far, toward a goal of ${formatKES(campaign.goal)}.`}
      >
        <div className="h-full bg-accent" style={{ width: `${share}%` }} />
        <div className="h-full bg-accent/35" style={{ width: `${rest}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> This challenge
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent/35" /> Rest of the harambee
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {donorCount.toLocaleString("en-KE")} {donorCount === 1 ? "donor" : "donors"} · harambee at{" "}
        {formatKES(campaign.raised)} of {formatKES(campaign.goal)}
      </p>
    </div>
  );
}
