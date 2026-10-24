"use client";

import { useEffect, useState } from "react";
import { copyText } from "@/lib/clipboard";

const smallButton =
  "flex items-center justify-center gap-1.5 rounded-xl bg-surface px-2 py-3 text-sm font-bold text-text ring-1 ring-black/15 active:scale-[0.99]";

// Facebook, X and Copy link, in one row under the WhatsApp buttons.
export default function ShareButtons({ url, text }: { url: string; text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    setStatus((await copyText(url)) ? "copied" : "failed");
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={smallButton}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v7h4v-7h3l1-4h-4V8z"
            fill="#1877F2"
          />
        </svg>
        Facebook
      </a>
      <a
        href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={smallButton}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M4 4l16 16M20 4 4 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        X
      </a>
      <button type="button" onClick={copy} className={smallButton}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span aria-live="polite">{status === "copied" ? "Copied!" : status === "failed" ? "Try again" : "Copy link"}</span>
      </button>
    </div>
  );
}
