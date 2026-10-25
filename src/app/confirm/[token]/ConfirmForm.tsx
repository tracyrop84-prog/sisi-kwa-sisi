"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { BENEFICIARY_AGREEMENT } from "@/lib/campaignRules";
import { formatKES } from "@/lib/format";
import { PHONE_CODE_LENGTH, PHONE_CODE_RESEND_SECONDS } from "@/lib/phone";
import { confirmAction, type ConfirmState } from "./actions";

const initialState: ConfirmState = { step: "code" };

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

const secondaryButton =
  "w-full rounded-xl bg-surface px-4 py-3 text-sm font-semibold text-text ring-1 ring-black/15 disabled:opacity-60";

export default function ConfirmForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(confirmAction, initialState);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!state.sentAt) return;
    setSecondsLeft(PHONE_CODE_RESEND_SECONDS);
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [state.sentAt]);

  if (state.step === "done") {
    const h = state.harambee;
    return (
      <div role="status" className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        {state.outcome === "live" && h ? (
          <>
            <p className="font-bold">Asante, {h.name}! Your harambee is live 🎉</p>
            <p className="mt-1 text-sm text-muted">It now shows that you confirmed it. Share it with friends and family.</p>
            <Link
              href={`/campaigns/${h.slug}`}
              className="mt-4 block w-full rounded-xl bg-accent px-6 py-3 text-center font-bold text-white active:scale-[0.99]"
            >
              See your harambee
            </Link>
          </>
        ) : state.outcome === "pending_approval" && h ? (
          <>
            <p className="font-bold">Asante, {h.name}!</p>
            <p className="mt-1 text-sm text-muted">
              Because the goal is large, our team checks this harambee before it goes live. The organiser will be able
              to share it once it’s approved.
            </p>
          </>
        ) : state.outcome === "declined" ? (
          <>
            <p className="font-bold">Thank you for telling us</p>
            <p className="mt-1 text-sm text-muted">
              We’ve closed this harambee, so it can’t take any money, and our team will look into it.
            </p>
          </>
        ) : (
          <p className="text-muted">{state.ended}</p>
        )}
      </div>
    );
  }

  if (state.step === "decline") {
    return (
      <form action={formAction} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <input type="hidden" name="token" value={token} />
        <p className="font-bold">Close this harambee?</p>
        <p className="text-sm text-muted">
          It will be closed for good and can’t take any money. Our team will be told so they can look into it.
        </p>
        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
        <button
          type="submit"
          name="intent"
          value="decline-yes"
          disabled={pending}
          className="w-full rounded-xl bg-text px-4 py-3 font-bold text-white disabled:opacity-70"
        >
          {pending ? "Closing…" : "Yes, close it"}
        </button>
        <button type="submit" name="intent" value="back" disabled={pending} className={secondaryButton}>
          Go back
        </button>
      </form>
    );
  }

  if (state.step === "review" && state.harambee) {
    const h = state.harambee;
    return (
      <form action={formAction} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="token" value={token} />
        <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-muted">
            Organised by <span className="font-semibold text-text">{h.organiser}</span> for{" "}
            <span className="font-semibold text-text">{h.name}</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            Goal: <span className="font-semibold text-text">{formatKES(h.goal)}</span>
          </p>
          <h2 className="mt-4 font-bold">Story</h2>
          <div className="mt-1 space-y-3 leading-relaxed">
            {h.story.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="whitespace-pre-line break-words">
                {para}
              </p>
            ))}
          </div>
        </section>

        <p className="text-sm text-muted">
          Once you confirm, the money raised can only be paid to the number this SMS was sent to.
        </p>

        <div>
          <label className="flex items-start gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-black/15">
            <input
              type="checkbox"
              name="agree"
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "confirm-error" : undefined}
              className="mt-1 h-4 w-4 shrink-0 accent-accent"
            />
            <span className="text-sm font-semibold">{BENEFICIARY_AGREEMENT}</span>
          </label>
          {state.error && <ErrorMessage id="confirm-error">{state.error}</ErrorMessage>}
        </div>

        <button
          type="submit"
          name="intent"
          value="confirm"
          disabled={pending}
          className="w-full rounded-xl bg-accent px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
        >
          {pending ? "Confirming…" : "Confirm"}
        </button>
        <button type="submit" name="intent" value="decline" disabled={pending} formNoValidate className={secondaryButton}>
          This isn’t me / I don’t agree
        </button>
      </form>
    );
  }

  const waiting = secondsLeft > 0;
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="code" className="font-semibold">Enter the code from the SMS</label>
        <p className="text-sm text-muted">
          {state.sentAt ? "We’ve sent you a new code. " : ""}It expires 10 minutes after it was sent. Then you’ll see the
          full harambee before you agree.
        </p>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={PHONE_CODE_LENGTH}
          placeholder="123456"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "code-error" : undefined}
          className={`${inputClass} text-center text-2xl font-bold tracking-[0.4em]`}
        />
        {state.error && <ErrorMessage id="code-error">{state.error}</ErrorMessage>}
      </div>
      <button
        type="submit"
        name="intent"
        value="verify"
        disabled={pending}
        className="w-full rounded-xl bg-accent px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {pending ? "Checking…" : "Continue"}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="submit"
          name="intent"
          value="resend"
          disabled={pending || waiting}
          formNoValidate
          className="rounded-xl bg-surface px-3 py-3 text-sm font-semibold text-accent ring-1 ring-accent/40 disabled:opacity-60"
        >
          {waiting ? `New code (${secondsLeft}s)` : "Send a new code"}
        </button>
        <button
          type="submit"
          name="intent"
          value="decline"
          disabled={pending}
          formNoValidate
          className="rounded-xl bg-surface px-3 py-3 text-sm font-semibold text-text ring-1 ring-black/15 disabled:opacity-60"
        >
          This isn’t me / I don’t agree
        </button>
      </div>
    </form>
  );
}
