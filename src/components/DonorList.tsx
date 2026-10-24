import type { Donation } from "@/lib/donations";
import { formatKES } from "@/lib/format";

const rtf = new Intl.RelativeTimeFormat("en-KE", { numeric: "auto" });

function timeAgo(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export default function DonorList({ donations }: { donations: Donation[] }) {
  if (donations.length === 0) {
    return <p className="mt-2 text-muted">No donations yet. Be the first to give.</p>;
  }

  return (
    <ul className="mt-2 divide-y divide-black/5 rounded-2xl bg-surface shadow-sm ring-1 ring-black/5">
      {donations.map((d) => (
        <li key={d.id} className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">{d.donorName ?? "Anonymous"}</p>
            <p className="whitespace-nowrap font-bold">{formatKES(d.amount)}</p>
          </div>
          {d.message && <p className="mt-1 text-sm leading-relaxed">{d.message}</p>}
          <p className="mt-1 text-xs text-muted">{timeAgo(d.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}
