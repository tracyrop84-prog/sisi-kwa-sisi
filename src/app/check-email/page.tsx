import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser, getPendingEmail, safeNext } from "@/lib/auth";
import ResendButton from "./ResendButton";

export const metadata: Metadata = { title: "Check your email · Sisi kwa Sisi" };

type Props = { searchParams: Promise<{ next?: string }> };

// Shown after every sign-up, including for emails that already have an account,
// so the page never gives away which emails are registered.
export default async function CheckEmailPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  const user = await getCurrentUser();
  if (user?.emailConfirmed) redirect(next);
  const email = user?.email || (await getPendingEmail());
  const nextQuery = next === "/campaigns" ? "" : `?next=${encodeURIComponent(next)}`;

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Check your email to confirm your account</h1>

      <div role="status" className="mt-4 rounded-2xl bg-accent/10 p-4">
        {email ? (
          <p>
            We sent a link to <span className="font-semibold break-all">{email}</span>. Open it to confirm your
            account, then you can start a harambee or create challenges.
          </p>
        ) : (
          <p>We sent you a link. Open it to confirm your account, then you can start a harambee or create challenges.</p>
        )}
      </div>

      <p className="mt-4 text-sm text-muted">
        It can take a minute to arrive. If you can’t find it, check your spam folder.
      </p>

      {email && (
        <div className="mt-6">
          <ResendButton next={next} />
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Already confirmed?{" "}
        <Link href={`/login${nextQuery}`} className="font-semibold text-accent">Log in</Link>
        {" · "}
        Wrong email?{" "}
        <Link href={`/signup${nextQuery}`} className="font-semibold text-accent">Sign up again</Link>
      </p>
    </main>
  );
}
