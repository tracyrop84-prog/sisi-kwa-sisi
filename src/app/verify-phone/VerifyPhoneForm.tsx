"use client";

import { useActionState, useEffect, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { formatKenyanPhone, PHONE_CODE_LENGTH, PHONE_CODE_RESEND_SECONDS } from "@/lib/phone";
import { verifyPhoneAction, type VerifyPhoneState } from "./actions";

const initialState: VerifyPhoneState = { step: "phone" };

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export default function VerifyPhoneForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(verifyPhoneAction, initialState);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!state.sentAt) return;
    setSecondsLeft(PHONE_CODE_RESEND_SECONDS);
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [state.sentAt]);

  if (state.step === "phone") {
    return (
      <form action={formAction} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="phone" className="font-semibold">Phone number</label>
          <p className="text-sm text-muted">We’ll send a 6-digit code by SMS. Only you and our team can see your number.</p>
          <input
            id="phone"
            name="phone"
            key={state.typed}
            defaultValue={state.typed}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "phone-error" : undefined}
            className={inputClass}
          />
          {state.error && <ErrorMessage id="phone-error">{state.error}</ErrorMessage>}
        </div>
        <button
          type="submit"
          name="intent"
          value="send"
          disabled={pending}
          className="w-full rounded-xl bg-accent px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
        >
          {pending ? "Sending…" : "Send code"}
        </button>
      </form>
    );
  }

  const waiting = secondsLeft > 0;
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="code" className="font-semibold">Enter the code</label>
        <p className="text-sm text-muted">
          We sent it to <span className="font-semibold text-text">{formatKenyanPhone(state.phone!)}</span>. It expires
          in 10 minutes.
        </p>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={PHONE_CODE_LENGTH}
          placeholder="123456"
          autoFocus
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
        {pending ? "Checking…" : "Verify"}
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
          {waiting ? `Resend code (${secondsLeft}s)` : "Resend code"}
        </button>
        <button
          type="submit"
          name="intent"
          value="change"
          disabled={pending}
          formNoValidate
          className="rounded-xl bg-surface px-3 py-3 text-sm font-semibold text-text ring-1 ring-black/15 disabled:opacity-60"
        >
          Change number
        </button>
      </div>
    </form>
  );
}
