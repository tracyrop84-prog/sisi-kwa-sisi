import type { Metadata } from "next";
import ErrorMessage from "@/components/ErrorMessage";
import SiteHeader from "@/components/SiteHeader";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password · Sisi kwa Sisi" };

type Props = { searchParams: Promise<{ error?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Forgot your password?</h1>
      <p className="mt-1 mb-6 text-muted">Enter your email and we’ll send you a link to set a new one.</p>
      {error === "browser" && (
        <div className="mb-5">
          <ErrorMessage>
            That reset link was opened in a different browser from the one you asked for it in. Ask for a new link
            here, then open the email on this same phone.
          </ErrorMessage>
        </div>
      )}
      {error === "link" && (
        <div className="mb-5">
          <ErrorMessage>That reset link has expired or was already used. Links work once and expire after an hour. Enter your email to get a new one.</ErrorMessage>
        </div>
      )}
      <ForgotPasswordForm />
    </main>
  );
}
