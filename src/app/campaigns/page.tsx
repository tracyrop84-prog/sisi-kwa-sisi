import type { Metadata } from "next";
import Link from "next/link";
import CampaignCard from "@/components/CampaignCard";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { getCampaigns, getMyUnpublishedCampaigns } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Harambees · Sisi kwa Sisi" };

type Props = { searchParams: Promise<{ show?: string }> };

export default async function CampaignsPage({ searchParams }: Props) {
  // Completed harambees get their own tab, so they never mix with ones still raising.
  const show = (await searchParams).show === "completed" ? "completed" : "running";
  const [campaigns, user] = await Promise.all([getCampaigns(show), getCurrentUser()]);
  // Only the organiser can see these, so this is the way back to them.
  const mine = user ? await getMyUnpublishedCampaigns(user.id) : [];

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <div className="flex items-end justify-between gap-4 pt-4 pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Harambees</h1>
        <Link href="/campaigns/new" className="text-sm font-semibold text-accent">
          + Start one
        </Link>
      </div>
      {mine.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-bold">Your harambees not live yet</h2>
          <ul className="flex flex-col gap-4">
            {mine.map((c) => (
              <li key={c.slug}>
                <CampaignCard campaign={c} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav aria-label="Show" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 text-sm font-semibold">
        <Tab href="/campaigns" current={show === "running"}>
          Active
        </Tab>
        <Tab href="/campaigns?show=completed" current={show === "completed"}>
          Completed
        </Tab>
      </nav>
      {campaigns.length === 0 ? (
        <p className="text-muted">
          {show === "completed" ? "No completed harambees yet." : "No active harambees right now."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {campaigns.map((c) => (
            <li key={c.slug}>
              <CampaignCard campaign={c} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Tab({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`rounded-lg py-2 text-center ${current ? "bg-surface text-text shadow-sm" : "text-muted"}`}
    >
      {children}
    </Link>
  );
}
