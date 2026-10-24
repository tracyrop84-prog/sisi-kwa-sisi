import type { Metadata } from "next";
import Link from "next/link";
import CampaignCard from "@/components/CampaignCard";
import SiteHeader from "@/components/SiteHeader";
import { getCampaigns } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Harambees · Sisi kwa Sisi" };

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <div className="flex items-end justify-between gap-4 pt-4 pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Harambees</h1>
        <Link href="/campaigns/new" className="text-sm font-semibold text-accent">
          + Start one
        </Link>
      </div>
      <ul className="flex flex-col gap-4">
        {campaigns.map((c) => (
          <li key={c.slug}>
            <CampaignCard campaign={c} />
          </li>
        ))}
      </ul>
    </main>
  );
}
