import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { canResetPassword, getCurrentUser } from "@/lib/auth";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Set a new password · Sisi kwa Sisi" };

// Reached from the link in the password reset email (via /auth/callback).
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  const allowed = user !== null && (await canResetPassword(user.id));

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Set a new password</h1>
      {allowed ? (
        <>
          <p className="mt-1 mb-6 text-muted">
            For <span className="font-semibold text-text break-all">{user.email}</span>
          </p>
          <ResetPasswordForm />
        </>
      ) : (
        <div className="mt-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <p>This page only works from the link in a password reset email, and the link may have expired.</p>
          <Link href="/forgot-password" className="mt-3 inline-block font-semibold text-accent">
            Get a new reset link
          </Link>
        </div>
      )}
    </main>
  );
}
