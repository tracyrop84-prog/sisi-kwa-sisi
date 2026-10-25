import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import { hasReported, MAX_REPORT_DETAILS, REPORT_REASONS } from "@/lib/reports";
import ReportForm from "./ReportForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Report a harambee · Sisi kwa Sisi" };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function ReportPage({ params, searchParams }: Props) {
  const [{ slug }, { from }] = await Promise.all([params, searchParams]);
  const here = `/campaigns/${slug}/report${from ? `?from=${encodeURIComponent(from)}` : ""}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}`);
  if (!user.emailConfirmed) redirect(`/check-email?next=${encodeURIComponent(here)}`);

  const campaign = await getCampaign(slug);
  if (!campaign) notFound();
  const back = safeNext(from, `/campaigns/${campaign.slug}`);
  const blocked =
    campaign.organiserId === user.id
      ? "You can’t report your own harambee."
      : campaign.status === "closed"
        ? "This harambee has already been closed."
        : (await hasReported(campaign.id))
          ? "You’ve already reported this harambee. Our team will review it."
          : null;

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <Link href={back} className="text-sm font-semibold text-accent">
        ← Back
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">Report this campaign</h1>
      <p className="mt-1 mb-6 text-muted">{campaign.title}</p>

      {blocked ? (
        <p className="rounded-2xl bg-surface p-4 text-muted shadow-sm ring-1 ring-black/5">{blocked}</p>
      ) : (
        <ReportForm
          campaignSlug={campaign.slug}
          from={from ? back : undefined}
          reasons={REPORT_REASONS}
          maxDetails={MAX_REPORT_DETAILS}
        />
      )}
    </main>
  );
}
