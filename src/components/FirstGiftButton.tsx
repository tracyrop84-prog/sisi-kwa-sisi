import Link from "next/link";
import { formatTimeLeft } from "@/lib/format";

// For a Mgeni Rasmi host who hasn't given yet: their gift starts the countdown.
export default function FirstGiftButton({ slug, msLeft }: { slug: string; msLeft: number }) {
  return (
    <div>
      <Link
        href={`/c/${slug}/donate`}
        className="block w-full rounded-xl bg-primary px-6 py-3 text-center font-bold text-white active:scale-[0.99] hover:brightness-95"
      >
        Make your first gift
      </Link>
      <p className="mt-1 text-center text-xs text-muted">
        Your gift starts the countdown. {formatTimeLeft(msLeft)} left to give.
      </p>
    </div>
  );
}
