"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { forgotPasswordAction, type AuthState } from "@/app/auth/actions";
import { emailError, readAuthForm } from "@/lib/validation";

const initialState: AuthState = { errors: {}, values: {} };

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);
  const [clientError, setClientError] = useState<string | undefined>();
  const error = clientError ?? state.errors.email;

  if (state.sent) {
    return (
      <div className="flex flex-col gap-5">
        <div role="status" className="rounded-2xl bg-accent/10 p-4">
          <p className="font-bold">If that email has an account, we’ve sent a reset link.</p>
          <p className="mt-1 text-sm text-muted">
            It can take a minute to arrive. If you can’t find it, check your spam folder.
          </p>
        </div>
        <Link href="/login" className="text-center text-sm font-semibold text-accent">
          Back to log in
        </Link>
      </div>
    );
  }

  function checkBeforeSubmit(e: FormEvent<HTMLFormElement>) {
    const found = emailError(readAuthForm(new FormData(e.currentTarget)).email);
    if (found) e.preventDefault();
    setClientError(found);
  }

  return (
    <form
      action={formAction}
      onSubmit={checkBeforeSubmit}
      key={state.values.email}
      className="flex flex-col gap-5"
      noValidate
    >
      <div>
        <label htmlFor="email" className="font-semibold">Email</label>
        <input
          name="email"
          id="email"
          defaultValue={state.values.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="name@example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-error" : undefined}
          className={inputClass}
        />
        {error && <ErrorMessage id="email-error">{error}</ErrorMessage>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-accent">Log in</Link>
      </p>
    </form>
  );
}
