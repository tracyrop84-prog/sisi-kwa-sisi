import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CopyWhatsAppButton from "@/components/CopyWhatsAppButton";
import DonorList from "@/components/DonorList";
import FirstGiftButton from "@/components/FirstGiftButton";
import LiveRefresh from "@/components/LiveRefresh";
import ProgressBar from "@/components/ProgressBar";
import SiteHeader from "@/components/SiteHeader";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import {
  challengeState,
  getCampaignChallenges,
  hostGiftDeadline,
  type Challenge,
  type ChallengeState,
} from "@/lib/challenges";
import { formatKES, formatTimeLeft } from "@/lib/format";
import { getDonations } from "@/lib/donations";
import { siteUrl } from "@/lib/site";
import { buildWhatsAppSummary } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ thanks?: string; challenge?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const campaign = await getCampaign((await params).slug);
  return { title: campaign ? `${campaign.title} · Sisi kwa Sisi` : "Not found" };
}

export default async function CampaignPage({ params, searchParams }: Props) {
  const campaign = await getCampaign((await params).slug);
  if (!campaign) notFound();

  const [donations, url, user, { thanks, challenge }] = await Promise.all([
    getDonations(campaign.id),
    siteUrl(`/campaigns/${campaign.slug}`),
    getCurrentUser(),
    searchParams,
  ]);

  const now = Date.now();
  const isOrganiser = !!user && campaign.organiserId === user.id;
  const challenges = user ? await getCampaignChallenges(campaign.id) : [];
  const pendingChallenges = isOrganiser
    ? challenges.filter((c) => challengeState(c, now) === "pending").length
    : 0;
  // The user's newest challenge here (the list is newest first).
  const mine = user ? challenges.find((c) => c.hostId === user.id) : undefined;
  const mineState = mine && challengeState(mine, now);
  // They can only have one waiting or running at a time, so hide "Create" until it's over.
  const canCreate = !mineState || ["ended", "expired", "declined"].includes(mineState);

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

      {challenge === "pending" && (
        <div role="status" className="mt-2 rounded-2xl bg-accent/10 p-4">
          <p className="font-bold">Challenge sent!</p>
          <p className="mt-1 text-sm text-muted">
            The organiser will review it. You can share it once it’s approved.
          </p>
        </div>
      )}
      {challenge === "live" && (
        <div role="status" className="mt-2 rounded-2xl bg-accent/10 p-4">
          <p className="font-bold">Your challenge is live!</p>
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

        {/* Seeded campaigns have no organiser to approve challenges, so they can't take any. */}
        {mine && mineState && (
          <div className="mt-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
            <Link href={`/c/${mine.slug}`} className="group flex items-center justify-between gap-3">
              <span>
                <span className="block font-bold text-accent group-hover:underline">Your challenge</span>
                <span className="mt-0.5 block text-sm text-muted">
                  <MyChallengeStatus challenge={mine} state={mineState} now={now} />
                </span>
              </span>
              <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-muted" aria-hidden="true">
                <path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            {mineState === "waiting-for-host" && (
              <div className="mt-3">
                <FirstGiftButton slug={mine.slug} msLeft={hostGiftDeadline(mine) - now} />
              </div>
            )}
          </div>
        )}

        {user && campaign.organiserId && (canCreate || isOrganiser) && (
          <div className="mt-4 flex gap-2">
            {canCreate && (
              <Link
                href={`/campaigns/${campaign.slug}/challenges/new`}
                className="flex-1 rounded-xl bg-surface px-4 py-3 text-center font-bold text-accent ring-1 ring-accent/40 active:scale-[0.99]"
              >
                Create challenge
              </Link>
            )}
            {isOrganiser && (
              <Link
                href={`/campaigns/${campaign.slug}/manage`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface px-4 py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99]"
              >
                Manage
                {pendingChallenges > 0 && (
                  <span
                    className="rounded-full bg-accent px-2 py-0.5 text-xs text-white"
                    aria-label={`${pendingChallenges} waiting for approval`}
                  >
                    {pendingChallenges}
                  </span>
                )}
              </Link>
            )}
          </div>
        )}

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

function MyChallengeStatus({ challenge: c, state, now }: { challenge: Challenge; state: ChallengeState; now: number }) {
  switch (state) {
    case "pending":
      return <>Waiting for organiser approval</>;
    case "waiting-for-host":
      return <>Approved! Waiting for your first gift</>;
    case "live":
      return <>Live · {formatKES(c.raised)} raised · {formatTimeLeft(new Date(c.endsAt!).getTime() - now)} left</>;
    case "ended":
      return <>Ended · {formatKES(c.raised)} raised</>;
    case "expired":
      return <>Expired: no first gift within 24 hours</>;
    case "declined":
      return <>Declined by the organiser</>;
  }
}
