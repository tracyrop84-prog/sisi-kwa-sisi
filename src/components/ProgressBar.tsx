import { formatKES, formatPercent, percentRaised } from "@/lib/format";

type Props = {
  raised: number;
  goal: number;
  donorCount: number;
  size?: "sm" | "lg";
};

export default function ProgressBar({ raised, goal, donorCount, size = "sm" }: Props) {
  const percent = percentRaised(raised, goal);
  const label = formatPercent(raised, goal);
  // A sliver for the first gifts, so the bar doesn't look empty.
  const width = percent === 0 && raised > 0 ? 1 : percent;
  const large = size === "lg";

  return (
    <div>
      <p className={large ? "text-2xl font-extrabold" : "font-bold"}>
        <span className="whitespace-nowrap">{formatKES(raised)}</span>{" "}
        <span className={`font-medium text-muted ${large ? "text-base" : "text-sm"}`}>
          raised of <span className="whitespace-nowrap">{formatKES(goal)}</span>
        </span>
      </p>
      <div
        className={`mt-2 w-full overflow-hidden rounded-full bg-accent/15 ${large ? "h-3" : "h-2"}`}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} raised`}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {label} · {donorCount.toLocaleString("en-KE")}{" "}
        {donorCount === 1 ? "donor" : "donors"}
      </p>
    </div>
  );
}
