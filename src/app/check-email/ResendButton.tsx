"use client";

import { useActionState, useEffect, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { resendConfirmationAction } from "@/app/auth/actions";

const COOLDOWN_SECONDS = 60; // Supabase won't send to the same email more often than this

export default function ResendButton({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(resendConfirmationAction, {});
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!state.sentAt) return;
    setSecondsLeft(COOLDOWN_SECONDS);
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [state.sentAt]);

  const waiting = secondsLeft > 0;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        disabled={pending || waiting}
        className="w-full rounded-xl bg-surface px-6 py-3 font-semibold text-accent ring-1 ring-accent/40 disabled:opacity-60"
      >
        {pending ? "Sending…" : waiting ? `Resend email (${secondsLeft}s)` : "Resend email"}
      </button>
      <div aria-live="polite">
        {state.sentAt && <p className="text-center text-sm text-muted">Sent again. Check your inbox.</p>}
        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      </div>
    </form>
  );
}
