import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminActions from "@/app/admin/AdminActions";
import ChallengeLeaderboard from "@/components/ChallengeLeaderboard";
import CopyWhatsAppButton from "@/components/CopyWhatsAppButton";
import DocumentsCheckedBadge from "@/components/DocumentsCheckedBadge";
import DonorList from "@/components/DonorList";
import FirstGiftButton from "@/components/FirstGiftButton";
import LiveRefresh from "@/components/LiveRefresh";
import Photo from "@/components/Photo";
import ProgressBar from "@/components/ProgressBar";
import ReportLink from "@/components/ReportLink";
import StatusBanner from "@/components/StatusBanner";
import SiteHeader from "@/components/SiteHeader";
import UpdatesTimeline from "@/components/UpdatesTimeline";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import CloseHarambeeButton from "./CloseHarambeeButton";
import ResubmitButton from "./ResubmitButton";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { canEditDetails, getCampaign } from "@/lib/campaigns";
import {
  challengeState,
  getCampaignChallenges,
  hostGiftDeadline,
  type Challenge,
  type ChallengeState,
} from "@/lib/challenges";
import { formatKES, formatTimeLeft } from "@/lib/format";
import { getDonations } from "@/lib/donations";
import { hasReported } from "@/lib/reports";
import { siteUrl } from "@/lib/site";
import { getGiftCount, getUpdates } from "@/lib/updates";
import { buildWhatsAppSummary } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ thanks?: string; challenge?: string; update?: string; edited?: string; reported?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const campaign = await getCampaign((await params).slug);
  return { title: campaign ? `${campaign.title} · Sisi kwa Sisi` : "Not found" };
}

export default async function CampaignPage({ params, searchParams }: Props) {
  const campaign = await getCampaign((await params).slug);
  if (!campaign) notFound();

  const [
    donations,
    url,
    user,
    admin,
    reported,
    challenges,
    updates,
    giftCount,
    { thanks, challenge, update, edited, reported: justReported },
  ] = await Promise.all([
    getDonations(campaign.id),
    siteUrl(`/campaigns/${campaign.slug}`),
    getCurrentUser(),
    isAdmin(),
    hasReported(campaign.id),
    getCampaignChallenges(campaign.id),
    getUpdates(campaign.id),
    getGiftCount(campaign.id),
    searchParams,
  ]);

  const now = Date.now();
  const isOrganiser = !!user && campaign.organiserId === user.id;
  // Paused, closed, completed and not-yet-approved campaigns take no donations
  // and no new challenges (see supabase/reports.sql, supabase/complete_campaign.sql
  // and supabase/organiser_verification.sql).
  const open = campaign.status === "active";
  const closed = campaign.status === "closed";
  const underReview = campaign.status === "paused" || closed;
  // Waiting for approval or for changes: only the organiser and admins get here.
  const unpublished = campaign.status === "pending" || campaign.status === "changes_requested";
  const liveChallenges = challenges
    .filter((c) => challengeState(c, now) === "live")
    .sort((a, b) => b.raised - a.raised);
  const pastChallenges = challenges
    .filter((c) => challengeState(c, now) === "ended")
    .sort((a, b) => b.endsAt!.localeCompare(a.endsAt!))
    .slice(0, 10);
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

  const longDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className={`mx-auto max-w-md px-5 ${open ? "pb-28" : "pb-10"}`}>
      <LiveRefresh campaignId={campaign.id} />
      <SiteHeader />

      <StatusBanner campaign={campaign} />
      {isOrganiser && campaign.status === "changes_requested" && <ResubmitButton slug={campaign.slug} />}
      {isOrganiser && underReview && (
        <div className="mt-2 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          {closed ? (
            <p className="font-bold">Your harambee has been closed after review</p>
          ) : (
            <>
              <p className="font-bold">Your harambee is under review</p>
              <p className="mt-1 text-sm text-muted">
                Our team is taking a look, so donations are paused and the harambee can’t be edited for now. You can
                still post updates to show how the money is being used. Donations resume if everything checks out.
              </p>
            </>
          )}
        </div>
      )}

      {justReported && (
        <div role="status" className="mt-2 rounded-2xl bg-accent/10 p-4">
          <p className="font-bold">Thanks for telling us</p>
          <p className="mt-1 text-sm text-muted">Our team will review this harambee. Your report is anonymous.</p>
        </div>
      )}

      {thanks && (
        <div role="status" className="mt-2 rounded-2xl bg-accent/10 p-4">
          <p className="font-bold">Asante sana for your donation!</p>
          <p className="mt-1 text-sm text-muted">
            Sharing on WhatsApp is the best way to help reach the goal.
          </p>
        </div>
      )}

      {update === "posted" && (
        <div role="status" className="mt-2 rounded-2xl bg-accent/10 p-4">
          <p className="font-bold">Update posted!</p>
          <p className="mt-1 text-sm text-muted">Share it on WhatsApp so donors see the news.</p>
        </div>
      )}
      {update === "deleted" && (
        <div role="status" className="mt-2 rounded-2xl bg-accent/10 p-4">
          <p className="font-bold">Update deleted</p>
        </div>
      )}
      {edited && (
        <div role="status" className="mt-2 rounded-2xl bg-accent/10 p-4">
          <p className="font-bold">Changes saved</p>
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
        {campaign.coverPhoto && (
          <Photo
            path={campaign.coverPhoto}
            alt={`Cover photo for ${campaign.title}`}
            eager
            className="mb-4 aspect-video w-full rounded-2xl"
          />
        )}
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
        {campaign.documentsCheckedAt && !closed && (
          <p className="mt-2">
            <DocumentsCheckedBadge />
          </p>
        )}

        <div className="mt-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <ProgressBar
            raised={campaign.raised}
            goal={campaign.goal}
            donorCount={campaign.donorCount}
            size="lg"
          />
          {/* Gifts in kind are counted on their own; their value never adds to the cash raised. */}
          {giftCount > 0 && (
            <p className="mt-1 text-sm font-semibold">
              <span aria-hidden="true">🎁</span> {giftCount.toLocaleString("en-KE")}{" "}
              {giftCount === 1 ? "gift" : "gifts"} received
            </p>
          )}
          {open && (
            <div className="mt-4 space-y-2">
              <WhatsAppShareButton text={whatsAppUpdate} />
              <CopyWhatsAppButton text={whatsAppUpdate} />
            </div>
          )}
        </div>

        {/* Seeded campaigns have no organiser to approve challenges, so they can't take any. */}
        {mine && mineState && (
          <div className="mt-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
            <Link href={`/c/${mine.slug}`} className="group flex items-center justify-between gap-3">
              <span>
                <span className="block font-bold text-accent group-hover:underline">Your challenge</span>
                <span className="mt-0.5 block text-sm text-muted">
                  <MyChallengeStatus challenge={mine} state={mineState} now={now} ended={campaign.status === "completed"} />
                </span>
              </span>
              <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-muted" aria-hidden="true">
                <path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            {mineState === "waiting-for-host" && open && (
              <div className="mt-3">
                <FirstGiftButton slug={mine.slug} msLeft={hostGiftDeadline(mine) - now} />
              </div>
            )}
          </div>
        )}

        {isOrganiser && !closed && (
          <div className="mt-4 flex gap-2">
            <Link
              href={`/campaigns/${campaign.slug}/updates/new`}
              className="flex-1 rounded-xl bg-surface px-4 py-3 text-center font-bold text-accent ring-1 ring-accent/40 active:scale-[0.99]"
            >
              Post update
            </Link>
            {canEditDetails(campaign.status) && (
              <Link
                href={`/campaigns/${campaign.slug}/edit`}
                className="flex-1 rounded-xl bg-surface px-4 py-3 text-center font-bold text-text ring-1 ring-black/15 active:scale-[0.99]"
              >
                Edit
              </Link>
            )}
          </div>
        )}
        {isOrganiser && !closed && (
          <Link
            href={`/campaigns/${campaign.slug}/documents`}
            className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-black/15 active:scale-[0.99]"
          >
            <span>
              <span className="block font-bold">Supporting documents</span>
              <span className="block text-sm text-muted">
                {campaign.documentsCheckedAt ? "Checked by our team" : "Private: only you and our team see them"}
              </span>
            </span>
            <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-muted" aria-hidden="true">
              <path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        {isOrganiser && open && (
          <CloseHarambeeButton
            slug={campaign.slug}
            finalTotal={formatKES(campaign.raised)}
            liveChallenges={challenges.filter((c) => ["live", "waiting-for-host"].includes(challengeState(c, now))).length}
          />
        )}

        {user && campaign.organiserId && ((canCreate && open) || isOrganiser) && (
          <div className="mt-4 flex gap-2">
            {canCreate && open && (
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

        {(liveChallenges.length > 0 || pastChallenges.length > 0) && (
          <section className="mt-6">
            <h2 className="text-lg font-bold">
              Live challenges{" "}
              <span className="font-medium text-muted">({liveChallenges.length})</span>
            </h2>
            <ChallengeLeaderboard live={liveChallenges} past={pastChallenges} now={now} />
          </section>
        )}

        {(updates.length > 0 || isOrganiser) && (
          <section className="mt-6">
            <h2 className="text-lg font-bold">
              Updates <span className="font-medium text-muted">({updates.length})</span>
            </h2>
            {updates.length > 0 ? (
              <UpdatesTimeline
                updates={updates}
                campaignTitle={campaign.title}
                campaignCategory={campaign.category}
                campaignSlug={campaign.slug}
                campaignUrl={url}
                isOrganiser={isOrganiser && !closed}
              />
            ) : (
              <p className="mt-2 text-muted">
                No updates yet. Post one to keep donors in the loop, like gifts received or{" "}
                {campaign.category === "Medical" ? "recovery news" : "progress"}.
              </p>
            )}
          </section>
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
          <p className="mt-4 text-sm text-muted">
            Started {longDate(campaign.createdAt)}
            {/* Set by the database when the title, story or location changes after the first donation. */}
            {campaign.lastEditedAt && <> · Edited {longDate(campaign.lastEditedAt)}</>}
          </p>
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

        {admin && open && (
          <section className="mt-8 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
            <h2 className="font-bold">Admin</h2>
            <p className="mt-0.5 text-sm text-muted">Pausing stops donations until you clear it from the dashboard.</p>
            <AdminActions campaignId={campaign.id} campaignSlug={campaign.slug} decisions={["pause"]} />
          </section>
        )}
        {admin && (
          <p className="mt-8 text-center text-sm">
            <Link href={`/admin/campaigns/${campaign.id}`} className="font-semibold text-accent">
              {campaign.status === "paused" || unpublished
                ? "Review in the admin dashboard"
                : "Organiser, documents and edit history"}
            </Link>
          </p>
        )}

        {!isOrganiser && !closed && !unpublished && <ReportLink campaignSlug={campaign.slug} reported={reported} />}
      </article>

      {open && (
        // Sticky donate bar — thumb-reachable on phones.
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
      )}
    </main>
  );
}

type MyChallengeProps = { challenge: Challenge; state: ChallengeState; now: number; ended: boolean };

function MyChallengeStatus({ challenge: c, state, now, ended }: MyChallengeProps) {
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
      // Closing a harambee declines challenges still waiting for approval.
      return ended ? <>Didn’t run: the harambee ended</> : <>Declined by the organiser</>;
  }
}
