"use client";

import { useEffect, useRef, useState } from "react";
import { logOutAction } from "@/app/auth/actions";

// The logged-in user's name in the header, opening a small menu with Log out.
// Closes on a tap outside or Escape.
export default function AccountMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold ring-1 ring-black/15"
      >
        <span className="max-w-28 truncate">{name}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl bg-surface p-2 shadow-lg ring-1 ring-black/10">
          <p className="truncate px-3 pt-1 text-sm font-semibold" title={name}>
            {name}
          </p>
          <p className="truncate px-3 pb-2 text-xs text-muted" title={email}>
            {email}
          </p>
          <form action={logOutAction} className="border-t border-black/5 pt-1">
            <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-black/5">
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
