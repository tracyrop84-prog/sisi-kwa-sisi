import { videoPlatform } from "@/lib/videoLinks";

// A link out to the video that went viral. Not an embed, so the page stays
// light on phones and no other site loads until someone taps.
export default function ViralVideoCard({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-4 flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5 active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
        <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
          <path d="M7 5.5v9l7.5-4.5z" fill="currentColor" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-accent">Watch the original video</span>
        <span className="block text-sm text-muted">On {videoPlatform(url)} · opens in a new tab</span>
      </span>
      <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-muted" aria-hidden="true">
        <path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
