import Link from "next/link";
import { CHALLENGE_TYPES, type Challenge } from "@/lib/challenges";
import { formatKES, formatTimeLeft } from "@/lib/format";

type Props = {
  live: Challenge[]; // sorted by amount raised, highest first
  past: Challenge[]; // ended, most recent first
  now: number;
};

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-muted" aria-hidden="true">
      <path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Live challenges ranked by amount raised, then a smaller list of past ones.
export default function ChallengeLeaderboard({ live, past, now }: Props) {
  return (
    <div>
      {live.length === 0 ? (
        <p className="mt-2 text-muted">No live challenges right now.</p>
      ) : (
        <ol className="mt-2 divide-y divide-black/5 rounded-2xl bg-surface shadow-sm ring-1 ring-black/5">
          {live.map((c, i) => (
            <li key={c.id}>
              <Link href={`/c/${c.slug}`} className="group flex items-center gap-3 px-4 py-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                    i === 0 ? "bg-accent text-white" : "bg-accent/10 text-accent"
                  }`}
                  aria-label={`Rank ${i + 1}`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-bold group-hover:underline">{c.hostName}</span>
                    <span className="whitespace-nowrap font-bold">{formatKES(c.raised)}</span>
                  </span>
                  <span className="mt-0.5 flex items-baseline justify-between gap-3 text-sm text-muted">
                    <span className="truncate">{CHALLENGE_TYPES[c.type].name}</span>
                    <span className="whitespace-nowrap">{formatTimeLeft(new Date(c.endsAt!).getTime() - now)} left</span>
                  </span>
                </span>
                <Chevron />
              </Link>
            </li>
          ))}
        </ol>
      )}

      {past.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-bold text-muted">Past challenges</h3>
          <ul className="mt-1 divide-y divide-black/5 text-sm">
            {past.map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.slug}`} className="group flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold group-hover:underline">{c.hostName}</span>
                    <span className="text-muted"> · {CHALLENGE_TYPES[c.type].name}</span>
                  </span>
                  <span className="whitespace-nowrap font-semibold">{formatKES(c.raised)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
