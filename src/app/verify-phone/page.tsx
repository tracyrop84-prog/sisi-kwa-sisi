import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { formatKenyanPhone } from "@/lib/phone";
import { getVerifiedPhone } from "@/lib/verification";
import VerifyPhoneForm from "./VerifyPhoneForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Verify your phone · Sisi kwa Sisi" };

type Props = { searchParams: Promise<{ next?: string; change?: string }> };

export default async function VerifyPhonePage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNext(params.next, "/campaigns/new");
  const here = `/verify-phone?next=${encodeURIComponent(next)}`;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}`);
  if (!user.emailConfirmed) redirect(`/check-email?next=${encodeURIComponent(here)}`);
  const verified = await getVerifiedPhone(user.id);

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Verify your phone</h1>
      {verified && !params.change ? (
        <div className="mt-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <p className="font-bold">Your number {formatKenyanPhone(verified)} is verified ✓</p>
          <Link
            href={next}
            className="mt-4 block w-full rounded-xl bg-accent px-6 py-3 text-center font-bold text-white active:scale-[0.99]"
          >
            Continue
          </Link>
          <Link href={`${here}&change=1`} className="mt-3 block text-center text-sm font-semibold text-accent">
            Use a different number
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-1 mb-6 text-muted">
            Every organiser verifies a Kenyan phone number before starting a harambee. It helps donors trust that
            organisers are real people.
          </p>
          <VerifyPhoneForm next={next} />
        </>
      )}
    </main>
  );
}
