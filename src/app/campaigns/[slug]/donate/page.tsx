import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProgressBar from "@/components/ProgressBar";
import StatusBanner from "@/components/StatusBanner";
import SiteHeader from "@/components/SiteHeader";
import { getCampaign } from "@/lib/campaigns";
import { MAX_MESSAGE, MAX_NAME } from "@/lib/donations";
import DonateForm from "./DonateForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const campaign = await getCampaign((await params).slug);
  return { title: campaign ? `Donate to ${campaign.title} · Sisi kwa Sisi` : "Not found" };
}

export default async function DonatePage({ params }: Props) {
  const campaign = await getCampaign((await params).slug);
  if (!campaign) notFound();

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <Link href={`/campaigns/${campaign.slug}`} className="text-sm font-semibold text-accent">
        ← Back to harambee
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">{campaign.title}</h1>
      <div className="mt-4 mb-6 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <ProgressBar raised={campaign.raised} goal={campaign.goal} donorCount={campaign.donorCount} />
      </div>
      {campaign.status === "active" ? (
        <DonateForm slug={campaign.slug} maxMessage={MAX_MESSAGE} maxName={MAX_NAME} />
      ) : (
        <StatusBanner campaign={campaign} />
      )}
    </main>
  );
}
