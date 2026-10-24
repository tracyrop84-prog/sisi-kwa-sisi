import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/app/auth/AuthForm";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an account · Sisi kwa Sisi" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function SignUpPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Create an account</h1>
      <p className="mt-1 mb-6 text-muted">You need an account to start a harambee. Donating doesn’t need one.</p>
      <AuthForm mode="signup" next={next} />
    </main>
  );
}
