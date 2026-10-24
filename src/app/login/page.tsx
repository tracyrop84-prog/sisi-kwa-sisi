import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/app/auth/AuthForm";
import ErrorMessage from "@/components/ErrorMessage";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in · Sisi kwa Sisi" };

type Props = { searchParams: Promise<{ next?: string; error?: string; confirmed?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next: rawNext, error, confirmed } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(next);

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Log in</h1>
      <p className="mt-1 mb-6 text-muted">Welcome back.</p>
      {confirmed && (
        <div role="status" className="mb-5 rounded-2xl bg-accent/10 p-4">
          <p className="font-bold">Your email is confirmed</p>
          <p className="mt-1 text-sm text-muted">Log in to start your harambee.</p>
        </div>
      )}
      {error === "link" && (
        <div className="mb-5">
          <ErrorMessage>
            That link has expired or was already used. Links work once and expire after an hour. Log in below. If
            your email isn’t confirmed yet, we’ll help you get a new link.
          </ErrorMessage>
        </div>
      )}
      <AuthForm mode="login" next={next} />
    </main>
  );
}
