"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

// "2d 04:12:09" or "04:12:09"
function format(ms: number): string {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const clock = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

// Ticks every second and refreshes the page at zero, so it switches to "ended".
export default function Countdown({ endsAt, label }: { endsAt: string; label: string }) {
  const router = useRouter();
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = Math.max(0, end - now);
  const done = left === 0;
  useEffect(() => {
    if (done) router.refresh();
  }, [done, router]);

  return (
    <div role="timer" className="text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {/* The server's clock and the phone's differ by a second or two. */}
      <p className="mt-1 text-3xl font-extrabold tabular-nums" suppressHydrationWarning>
        {format(left)}
      </p>
    </div>
  );
}
