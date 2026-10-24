"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  errors: Partial<Record<Field, string>>;
  formError?: string;
  values: Partial<Record<"name" | "email", string>>; // never echo the password back
  checkEmail?: boolean;
};

type Field = "name" | "email" | "password";

const MIN_PASSWORD = 8;

function friendlyError(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "That email and password don’t match. Please try again.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Log in instead.";
    case "weak_password":
      return "Choose a stronger password.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    next: safeNext(formData.get("next")),
  };
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { name, email, password, next } = readForm(formData);
  const values = { name, email };

  const errors: AuthState["errors"] = {};
  if (!name) errors.name = "Add your name. Donors will see it on your harambees.";
  if (name.length > 60) errors.name = "Keep your name under 60 characters.";
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email address.";
  if (password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: await siteUrl(`/auth/callback?next=${encodeURIComponent(next)}`),
    },
  });
  if (error) return { errors: {}, values, formError: friendlyError(error.code) };

  // No session means Supabase wants the user to confirm their email first.
  if (!data.session) return { errors: {}, values, checkEmail: true };
  redirect(next);
}

export async function logInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, next } = readForm(formData);
  const values = { email };

  const errors: AuthState["errors"] = {};
  if (!email) errors.email = "Enter your email address.";
  if (!password) errors.password = "Enter your password.";
  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { errors: {}, values, formError: friendlyError(error.code) };
  redirect(next);
}

export async function logOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
