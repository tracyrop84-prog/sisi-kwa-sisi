"use client";

import { useEffect, useState } from "react";

// Copies a ready-made WhatsApp update so organisers can paste it into a group.
export default function CopyWhatsAppButton({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      // The Clipboard API needs HTTPS; fall back for older phones and http:// testing.
      setStatus(copyWithTextarea(text) ? "copied" : "failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface px-6 py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99]"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <span aria-live="polite">
        {status === "copied" ? "Copied! Paste it in your group" : status === "failed" ? "Couldn't copy, try again" : "Copy WhatsApp update"}
      </span>
    </button>
  );
}

function copyWithTextarea(text: string): boolean {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    el.remove();
  }
}
