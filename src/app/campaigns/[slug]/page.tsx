import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CopyWhatsAppButton from "@/components/CopyWhatsAppButton";
import DonorList from "@/components/DonorList";
import LiveRefresh from "@/components/LiveRefresh";
import ProgressBar from "@/components/ProgressBar";
import SiteHeader from "@/components/SiteHeader";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { getCampaign } from "@/lib/campaigns";
import { getDonations } from "@/lib/donations";
import { siteUrl } from "@/lib/site";
import { buildWhatsAppSummary } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ thanks?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const campaign = await getCampaign((await params).slug);
  return { title: campaign ? `${campaign.title} · Sisi kwa Sisi` : "Not found" };
}

export default async function CampaignPage({ params, searchParams }: Props) {
  const campaign = await getCampaign((await params).slug);
  if (!campaign) notFound();

  const [donations, url, { thanks }] = await Promise.all([
    getDonations(campaign.id),
    siteUrl(`/campaigns/${campaign.slug}`),
    searchParams,
  ]);

  const whatsAppUpdate = buildWhatsAppSummary({
    title: campaign.title,
    raised: campaign.raised,
    goal: campaign.goal,
    donorCount: campaign.donorCount,
    donors: donations.map((d) => ({ name: d.donorName, amount: d.amount })),
    url,
  });

  const started = new Date(campaign.createdAt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-md px-5 pb-28">
      <LiveRefresh campaignId={campaign.id} />
      <SiteHeader />

      {thanks && (
        <div role="status" className="mt-2 rounded-2xl bg-accent/10 p-4">
          <p className="font-bold">Asante sana for your donation!</p>
          <p className="mt-1 text-sm text-muted">
            Sharing on WhatsApp is the best way to help reach the goal.
          </p>
        </div>
      )}

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
          <div className="mt-4 space-y-2">
            <WhatsAppShareButton text={whatsAppUpdate} />
            <CopyWhatsAppButton text={whatsAppUpdate} />
          </div>
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

        <section className="mt-8">
          <h2 className="text-lg font-bold">
            Donors{" "}
            <span className="font-medium text-muted">
              ({campaign.donorCount.toLocaleString("en-KE")})
            </span>
          </h2>
          <DonorList donations={donations} />
        </section>
      </article>

      {/* Sticky donate bar — thumb-reachable on phones. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-surface/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          <Link
            href={`/campaigns/${campaign.slug}/donate`}
            className="block w-full rounded-xl bg-primary px-6 py-4 text-center text-lg font-bold text-white active:scale-[0.99] hover:brightness-95"
          >
            Donate
          </Link>
        </div>
      </div>
    </main>
  );
}
