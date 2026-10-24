"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import NewPasswordFields from "@/components/NewPasswordFields";
import PasswordInput from "@/components/PasswordInput";
import { logInErrors, readAuthForm, signUpErrors, type AuthErrors } from "@/lib/validation";
import { logInAction, signUpAction, type AuthState } from "./actions";

const initialState: AuthState = { errors: {}, values: {} };

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

type Props = { mode: "login" | "signup"; next: string };

export default function AuthForm({ mode, next }: Props) {
  const signup = mode === "signup";
  const [state, formAction, pending] = useActionState(signup ? signUpAction : logInAction, initialState);
  // Errors found in the browser before submitting; null once the form passes.
  const [clientErrors, setClientErrors] = useState<AuthErrors | null>(null);
  const errors = clientErrors ?? state.errors;
  const { values, formError } = state;
  const nextQuery = next === "/campaigns" ? "" : `?next=${encodeURIComponent(next)}`;

  function checkBeforeSubmit(e: FormEvent<HTMLFormElement>) {
    const form = readAuthForm(new FormData(e.currentTarget));
    const found = signup ? signUpErrors(form) : logInErrors(form);
    if (Object.keys(found).length > 0) {
      e.preventDefault();
      setClientErrors(found);
    } else {
      setClientErrors(null);
    }
  }

  const field = (name: "name" | "email") => ({
    name,
    id: name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    // key resets defaultValues after a failed submit so the user's input is kept
    <form
      action={formAction}
      onSubmit={checkBeforeSubmit}
      key={JSON.stringify(values)}
      className="flex flex-col gap-5"
      noValidate
    >
      <input type="hidden" name="next" value={next} />
      {formError && !clientErrors && <ErrorMessage>{formError}</ErrorMessage>}

      {signup && (
        <div>
          <label htmlFor="name" className="font-semibold">Your name</label>
          <input {...field("name")} defaultValue={values.name} className={inputClass} autoComplete="name" maxLength={60} />
          {errors.name && <ErrorMessage id="name-error">{errors.name}</ErrorMessage>}
        </div>
      )}

      <div>
        <label htmlFor="email" className="font-semibold">Email</label>
        <input
          {...field("email")}
          defaultValue={values.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="name@example.com"
          className={inputClass}
        />
        {errors.email && <ErrorMessage id="email-error">{errors.email}</ErrorMessage>}
      </div>

      {signup ? (
        <NewPasswordFields label="Password" errors={errors} />
      ) : (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="password" className="font-semibold">Password</label>
            <Link href="/forgot-password" className="text-sm font-semibold text-accent">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            name="password"
            id="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          {errors.password && <ErrorMessage id="password-error">{errors.password}</ErrorMessage>}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {pending ? (signup ? "Creating account…" : "Logging in…") : signup ? "Create account" : "Log in"}
      </button>

      <p className="text-center text-sm text-muted">
        {signup ? "Already have an account? " : "New to Sisi kwa Sisi? "}
        <Link href={`${signup ? "/login" : "/signup"}${nextQuery}`} className="font-semibold text-accent">
          {signup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
