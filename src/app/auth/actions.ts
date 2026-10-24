"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  canResetPassword,
  endPasswordReset,
  getCurrentUser,
  getPendingEmail,
  rememberPendingEmail,
  safeNext,
} from "@/lib/auth";
import { friendlyAuthError } from "@/lib/authErrors";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import {
  emailError,
  logInErrors,
  newPasswordErrors,
  readAuthForm,
  signUpErrors,
  type AuthErrors,
} from "@/lib/validation";

export type AuthState = {
  errors: AuthErrors;
  formError?: string;
  values: Partial<Record<"name" | "email", string>>; // never echo the password back
  sent?: boolean;
  linkExpired?: boolean; // offer a link to request a new email
};

// Supabase errors that would reveal whether an email already has an account.
// We act as if the email was sent, so nobody can probe which emails are registered.
const HIDDEN_SIGNUP_ERRORS = new Set(["user_already_exists", "email_exists", "over_email_send_rate_limit"]);

function errorState(error: AuthError, values: AuthState["values"]): AuthState {
  const { field, message, linkExpired } = friendlyAuthError(error);
  return field ? { errors: { [field]: message }, values } : { errors: {}, values, formError: message, linkExpired };
}

function readForm(formData: FormData) {
  return { ...readAuthForm(formData), next: safeNext(formData.get("next")) };
}

function checkEmailPath(next: string) {
  return next === "/campaigns" ? "/check-email" : `/check-email?next=${encodeURIComponent(next)}`;
}

// Where the link in the confirmation email sends people.
async function confirmUrl(next: string) {
  return siteUrl(`/auth/callback?next=${encodeURIComponent(next)}`);
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const form = readForm(formData);
  const { name, email, password, next } = form;
  const values = { name, email };

  const errors = signUpErrors(form);
  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: await confirmUrl(next),
    },
  });
  if (error && !HIDDEN_SIGNUP_ERRORS.has(error.code ?? "")) return errorState(error, values);

  await rememberPendingEmail(email);
  redirect(checkEmailPath(next));
}

export async function logInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const form = readForm(formData);
  const { email, password, next } = form;
  const values = { email };

  const errors = logInErrors(form);
  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === "email_not_confirmed") {
    await rememberPendingEmail(email);
    redirect(checkEmailPath(next));
  }
  if (error) return errorState(error, values);
  redirect(next);
}

export type ResendState = { sentAt?: number; error?: string };

export async function resendConfirmationAction(_prev: ResendState, formData: FormData): Promise<ResendState> {
  const next = safeNext(formData.get("next"));
  const user = await getCurrentUser();
  const email = user?.email || (await getPendingEmail());
  if (!email) return { error: "We don’t know which email to send it to. Please sign up again." };

  const supabase = await createClient();
  // Errors such as "already confirmed" or "sent too recently" are ignored on purpose:
  // the reply must look the same whether or not the email has an account.
  await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: await confirmUrl(next) } });
  return { sentAt: Date.now() };
}

export async function forgotPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email } = readAuthForm(formData);
  const values = { email };

  const error = emailError(email);
  if (error) return { errors: { email: error }, values };

  const supabase = await createClient();
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await siteUrl("/auth/callback?next=/reset-password"),
  });
  // Same reply whatever happened, so nobody can check which emails are registered.
  if (resetError) console.error("resetPasswordForEmail failed:", resetError.code);
  return { errors: {}, values, sent: true };
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { password, confirmPassword } = readAuthForm(formData);

  const errors = newPasswordErrors(password, confirmPassword);
  if (Object.keys(errors).length > 0) return { errors, values: {} };

  const user = await getCurrentUser();
  if (!user || !(await canResetPassword(user.id))) {
    return {
      errors: {},
      values: {},
      formError: "This reset link has expired or was already used. Please request a new one.",
      linkExpired: true,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return errorState(error, {});

  await endPasswordReset();
  redirect("/campaigns");
}

export async function logOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
