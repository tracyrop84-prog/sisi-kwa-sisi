"use client";

import Link from "next/link";
import { useActionState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { logInAction, signUpAction, type AuthState } from "./actions";

const initialState: AuthState = { errors: {}, values: {} };

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

type Props = { mode: "login" | "signup"; next: string };

export default function AuthForm({ mode, next }: Props) {
  const signup = mode === "signup";
  const [state, formAction, pending] = useActionState(signup ? signUpAction : logInAction, initialState);
  const { errors, values, formError, checkEmail } = state;
  const nextQuery = next === "/campaigns" ? "" : `?next=${encodeURIComponent(next)}`;

  if (checkEmail) {
    return (
      <div role="status" className="rounded-2xl bg-accent/10 p-4">
        <p className="font-bold">Check your email</p>
        <p className="mt-1 text-sm text-muted">
          We sent a link to <span className="font-semibold text-text">{values.email}</span>. Open it
          to confirm your account, then you can start a harambee.
        </p>
      </div>
    );
  }

  const field = (name: keyof AuthState["errors"]) => ({
    name,
    id: name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    // key resets defaultValues after a failed submit so the user's input is kept
    <form action={formAction} key={JSON.stringify(values)} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {formError && <ErrorMessage>{formError}</ErrorMessage>}

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
          className={inputClass}
        />
        {errors.email && <ErrorMessage id="email-error">{errors.email}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="password" className="font-semibold">Password</label>
        <input
          {...field("password")}
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          className={inputClass}
        />
        {signup && !errors.password && <p className="mt-1 text-sm text-muted">At least 8 characters.</p>}
        {errors.password && <ErrorMessage id="password-error">{errors.password}</ErrorMessage>}
      </div>

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
