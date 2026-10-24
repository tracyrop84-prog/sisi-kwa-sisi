"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import NewPasswordFields from "@/components/NewPasswordFields";
import { resetPasswordAction, type AuthState } from "@/app/auth/actions";
import { newPasswordErrors, readAuthForm, type AuthErrors } from "@/lib/validation";

const initialState: AuthState = { errors: {}, values: {} };

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);
  const [clientErrors, setClientErrors] = useState<AuthErrors | null>(null);
  const errors = clientErrors ?? state.errors;

  function checkBeforeSubmit(e: FormEvent<HTMLFormElement>) {
    const { password, confirmPassword } = readAuthForm(new FormData(e.currentTarget));
    const found = newPasswordErrors(password, confirmPassword);
    if (Object.keys(found).length > 0) {
      e.preventDefault();
      setClientErrors(found);
    } else {
      setClientErrors(null);
    }
  }

  return (
    <form action={formAction} onSubmit={checkBeforeSubmit} className="flex flex-col gap-5" noValidate>
      {state.formError && !clientErrors && (
        <div>
          <ErrorMessage>{state.formError}</ErrorMessage>
          {state.linkExpired && (
            <Link href="/forgot-password" className="mt-2 inline-block text-sm font-semibold text-accent">
              Get a new reset link
            </Link>
          )}
        </div>
      )}
      <NewPasswordFields label="New password" errors={errors} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
