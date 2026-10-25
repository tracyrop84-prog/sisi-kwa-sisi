import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChallengeProgress from "@/components/ChallengeProgress";
import CopyWhatsAppButton from "@/components/CopyWhatsAppButton";
import Countdown from "@/components/Countdown";
import DonorList from "@/components/DonorList";
import FirstGiftButton from "@/components/FirstGiftButton";
import LiveRefresh from "@/components/LiveRefresh";
import ReportLink from "@/components/ReportLink";
import StatusBanner from "@/components/StatusBanner";
import ShareButtons from "@/components/ShareButtons";
import SiteHeader from "@/components/SiteHeader";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { getCurrentUser } from "@/lib/auth";
import { getCampaignById } from "@/lib/campaigns";
import {
  CHALLENGE_TYPES,
  challengeState,
  challengeTitle,
  durationLabel,
  firstName,
  getChallenge,
  hostGiftDeadline,
} from "@/lib/challenges";
import { getChallengeDonations } from "@/lib/donations";
import { formatKES } from "@/lib/format";
import { hasReported } from "@/lib/reports";
import { siteUrl } from "@/lib/site";
import { buildChallengeInvite, buildWhatsAppSummary } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ thanks?: string; reported?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const challenge = await getChallenge((await params).slug);
  if (!challenge) return { title: "Not found" };
  const campaign = await getCampaignById(challenge.campaignId);
  const title = challengeTitle(challenge);
  const description = `Join ${challenge.hostName}’s challenge for ${campaign?.title ?? "this harambee"}. All money goes directly to the harambee.`;
  return {
    // Absolute base so WhatsApp and Facebook can fetch the preview image (./opengraph-image.tsx).
    metadataBase: new URL(await siteUrl()),
    title: `${title} · Sisi kwa Sisi`,
    description,
    openGraph: { title, description, url: `/c/${challenge.slug}`, siteName: "Sisi kwa Sisi", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ChallengePage({ params, searchParams }: Props) {
  const challenge = await getChallenge((await params).slug);
  if (!challenge) notFound();

  const [campaign, donations, user, url, reported, { thanks, reported: justReported }] = await Promise.all([
    getCampaignById(challenge.campaignId),
    getChallengeDonations(challenge.id),
    getCurrentUser(),
    siteUrl(`/c/${challenge.slug}`),
    hasReported(challenge.campaignId),
    searchParams,
  ]);
  if (!campaign) notFound();
  // The database refuses donations while the campaign is paused or closed (supabase/reports.sql).
  // Challenge timers keep running meanwhile.
  const open = campaign.status === "active";

  const now = Date.now();
  const state = challengeState(challenge, now);
  const isHost = user?.id === challenge.hostId;
  const first = firstName(challenge.hostName);
  const type = CHALLENGE_TYPES[challenge.type];
  const isMgeniRasmi = challenge.type === "mgeni_rasmi";
  const over = state === "ended" || state === "expired" || state === "declined";
  const hasStickyBar = open && (state === "live" || over);

  const invite =
    state === "live" &&
    buildChallengeInvite({
      hostName: challenge.hostName,
      campaignTitle: campaign.title,
      mgeniRasmi: isMgeniRasmi,
      challengeName: type.name,
      preset: type.preset,
      hostGift: challenge.hostGift,
      raised: challenge.raised,
      target: challenge.target,
      msLeft: new Date(challenge.endsAt!).getTime() - now,
      url,
    });
  // The Phase 3 update, measured against the target if there is one.
  const whatsAppUpdate = buildWhatsAppSummary({
    title: `${challengeTitle(challenge)} for ${campaign.title}`,
    raised: challenge.raised,
    goal: challenge.target,
    donorCount: challenge.donorCount,
    donors: donations.map((d) => ({ name: d.donorName, amount: d.amount })),
    url,
  });

  return (
    <main className={`mx-auto max-w-md px-5 ${hasStickyBar ? "pb-28" : "pb-10"}`}>
      <LiveRefresh campaignId={campaign.id} challengeId={challenge.id} />
      <SiteHeader />

      <StatusBanner campaign={campaign} />
      {justReported && (
        <div role="status" className="mt-2 rounded-2xl bg-accent/10 p-4">
          <p className="font-bold">Thanks for telling us</p>
          <p className="mt-1 text-sm text-muted">Our team will review this harambee. Your report is anonymous.</p>
        </div>
      )}

      {thanks && (
        <div role="status" className="mt-2 rounded-2xl bg-accent/10 p-4">
          {isHost && isMgeniRasmi && donations.length === 1 ? (
            <>
              <p className="font-bold">Your gift started the countdown!</p>
              <p className="mt-1 text-sm text-muted">Now share the link so friends can join you.</p>
            </>
          ) : (
            <>
              <p className="font-bold">Asante sana for your donation!</p>
              <p className="mt-1 text-sm text-muted">
                It counts toward {first}’s challenge and goes straight to the harambee.
              </p>
            </>
          )}
        </div>
      )}

      <article className="pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {type.name} · {type.tagline}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight">{challengeTitle(challenge)}</h1>
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold text-text">{challenge.hostName}</span> is hosting this challenge for{" "}
          <Link href={`/campaigns/${campaign.slug}`} className="font-semibold text-accent">
            {campaign.title}
          </Link>
          {challenge.hostGift !== null && <> and started it with {formatKES(challenge.hostGift)}</>}. It runs
          for {durationLabel(challenge.durationMinutes)}.
        </p>

        <div className="mt-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          {state === "pending" && (
            <StatusMessage title="Waiting for organiser approval">
              Donations open once {campaign.organiser} approves this challenge.
            </StatusMessage>
          )}

          {state === "declined" &&
            (campaign.status === "completed" ? (
              <StatusMessage title="This challenge didn’t run">The harambee ended before it was approved.</StatusMessage>
            ) : (
              <StatusMessage title="This challenge isn’t running">
                The organiser didn’t approve it. You can still give to the harambee directly.
              </StatusMessage>
            ))}

          {state === "waiting-for-host" &&
            (isHost ? (
              <>
                <StatusMessage title="Approved! Make your first gift">
                  As Mgeni Rasmi you give first. Your gift starts the {durationLabel(challenge.durationMinutes)}{" "}
                  countdown, then you share the link.
                </StatusMessage>
                {open && (
                  <div className="mt-4">
                    <FirstGiftButton slug={challenge.slug} msLeft={hostGiftDeadline(challenge) - now} />
                  </div>
                )}
              </>
            ) : (
              <StatusMessage title="Starting soon">
                The countdown starts when {first} makes the first gift.
              </StatusMessage>
            ))}

          {state === "live" && (
            <>
              <Countdown endsAt={challenge.endsAt!} label="Challenge ends in" />
              <div className="mt-4 border-t border-black/5 pt-4">
                <ChallengeProgress
                  raised={challenge.raised}
                  donorCount={challenge.donorCount}
                  target={challenge.target}
                  campaign={campaign}
                />
              </div>
              {invite && open && (
                <div className="mt-4 space-y-2">
                  <WhatsAppShareButton text={invite} />
                  <ShareButtons url={url} text={`${challengeTitle(challenge)} for ${campaign.title}`} />
                  <CopyWhatsAppButton text={whatsAppUpdate} />
                </div>
              )}
            </>
          )}

          {(state === "ended" || state === "expired") && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {state === "ended" ? "Challenge ended · final total" : "Challenge expired"}
              </p>
              {state === "expired" && (
                <p className="mt-1 text-sm text-muted">{first} didn’t make the first gift within 24 hours.</p>
              )}
              <div className="mt-3">
                <ChallengeProgress
                  raised={challenge.raised}
                  donorCount={challenge.donorCount}
                  target={challenge.target}
                  campaign={campaign}
                />
              </div>
            </>
          )}
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-accent/10 px-4 py-3 text-sm">
          <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true">
            <path d="M10 2 3 5v5c0 4 3 7 7 8 4-1 7-4 7-8V5l-7-3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="m7 10 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            All money goes directly to{" "}
            <Link href={`/campaigns/${campaign.slug}`} className="font-semibold text-accent">
              {campaign.title}
            </Link>
            .
          </span>
        </p>

        {state !== "pending" && state !== "declined" && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">
              Donors{" "}
              <span className="font-medium text-muted">({challenge.donorCount.toLocaleString("en-KE")})</span>
            </h2>
            <DonorList donations={donations} />
          </section>
        )}

        {user?.id !== campaign.organiserId && campaign.status !== "closed" && (
          <ReportLink campaignSlug={campaign.slug} reported={reported} from={`/c/${challenge.slug}`} />
        )}
      </article>

      {hasStickyBar && (
        // Sticky donate bar — thumb-reachable on phones.
        <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-surface/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto max-w-md">
            {state === "live" ? (
              <Link
                href={`/c/${challenge.slug}/donate`}
                className="block w-full rounded-xl bg-primary px-6 py-3 text-center text-lg font-bold text-white active:scale-[0.99] hover:brightness-95"
              >
                {isMgeniRasmi ? (
                  <>
                    Sindikiza {first}
                    <span className="block text-xs font-semibold opacity-90">Give with M-Pesa</span>
                  </>
                ) : (
                  "Donate"
                )}
              </Link>
            ) : (
              <Link
                href={`/campaigns/${campaign.slug}/donate`}
                className="block w-full rounded-xl bg-primary px-6 py-4 text-center text-lg font-bold text-white active:scale-[0.99] hover:brightness-95"
              >
                Donate to the harambee
              </Link>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function StatusMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}
