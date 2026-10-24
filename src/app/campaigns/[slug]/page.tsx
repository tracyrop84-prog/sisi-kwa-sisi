import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProgressBar from "@/components/ProgressBar";
import SiteHeader from "@/components/SiteHeader";
import { getCampaign } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const campaign = await getCampaign((await params).slug);
  return { title: campaign ? `${campaign.title} · Sisi kwa Sisi` : "Not found" };
}

export default async function CampaignPage({ params }: Props) {
  const campaign = await getCampaign((await params).slug);
  if (!campaign) notFound();

  const started = new Date(campaign.createdAt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-md px-5 pb-28">
      <SiteHeader />

      <article className="pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {campaign.category} · {campaign.location}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight">
          {campaign.title}
        </h1>
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold text-text">{campaign.organiser}</span> is
          organising this harambee for{" "}
          <span className="font-semibold text-text">{campaign.beneficiary}</span>
        </p>

        <div className="mt-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <ProgressBar
            raised={campaign.raised}
            goal={campaign.goal}
            donorCount={campaign.donorCount}
            size="lg"
          />
        </div>

        <section className="mt-6">
          <h2 className="text-lg font-bold">Story</h2>
          <div className="mt-2 space-y-3 leading-relaxed">
            {campaign.story.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="whitespace-pre-line">
                {para}
              </p>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">Started {started}</p>
        </section>
      </article>

      {/* Sticky donate bar — thumb-reachable on phones. Donations arrive in Phase 2. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-surface/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            disabled
            title="Donations are coming soon"
            className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-bold text-white disabled:opacity-90"
          >
            Donate
          </button>
          <p className="mt-1 text-center text-xs text-muted">Donations open soon</p>
        </div>
      </div>
    </main>
  );
}
