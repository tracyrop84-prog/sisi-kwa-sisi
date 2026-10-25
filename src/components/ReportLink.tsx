import Link from "next/link";

type Props = {
  campaignSlug: string;
  reported: boolean; // the viewer already has an open report on this campaign
  from?: string; // page to come back to, e.g. a challenge page
};

// Grey on purpose: reporting should be easy to find but never compete with Donate.
export default function ReportLink({ campaignSlug, reported, from }: Props) {
  if (reported) {
    return <p className="mt-8 text-center text-sm text-muted">You’ve reported this harambee. Our team will review it.</p>;
  }
  const href = `/campaigns/${campaignSlug}/report${from ? `?from=${encodeURIComponent(from)}` : ""}`;
  return (
    <p className="mt-8 text-center">
      <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-2 hover:underline">
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path d="M5 18V3m0 1h9l-2 3.5 2 3.5H5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Report this campaign
      </Link>
    </p>
  );
}
