import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import FirstGiftButton from "@/components/FirstGiftButton";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import {
  CHALLENGE_TYPES,
  challengeState,
  durationLabel,
  getCampaignChallenges,
  hostGiftDeadline,
  MAX_LIVE_CHALLENGES,
  type Challenge,
  type ChallengeState,
} from "@/lib/challenges";
import { formatKES, formatTimeLeft } from "@/lib/format";
import ReviewButtons from "./ReviewButtons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Manage challenges · Sisi kwa Sisi" };

type Props = { params: Promise<{ slug: string }> };

export default async function ManagePage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/campaigns/${slug}/manage`);

  const campaign = await getCampaign(slug);
  // Only the organiser gets a dashboard; everyone else sees a plain 404.
  if (!campaign || campaign.organiserId !== user.id) notFound();

  const challenges = await getCampaignChallenges(campaign.id);
  const now = Date.now();
  const withState = challenges.map((c) => ({ c, state: challengeState(c, now) }));
  const pending = withState.filter((x) => x.state === "pending");
  const live = withState
    .filter((x) => x.state === "live" || x.state === "waiting-for-host")
    .sort((a, b) => b.c.raised - a.c.raised);
  const finished = withState.filter(
    (x) => x.state === "ended" || x.state === "expired" || x.state === "declined",
  );

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <Link href={`/campaigns/${campaign.slug}`} className="text-sm font-semibold text-accent">
        ← Back to harambee
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">Manage challenges</h1>
      <p className="mt-1 text-muted">{campaign.title}</p>

      <section className="mt-6">
        <h2 className="text-lg font-bold">
          Waiting for approval <span className="font-medium text-muted">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-muted">Nothing to review right now.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {pending.map(({ c, state }) => (
              <li key={c.id} className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
                <ChallengeSummary challenge={c} state={state} now={now} />
                <ReviewButtons challengeId={c.id} campaignSlug={campaign.slug} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">
          Live{" "}
          <span className="font-medium text-muted">
            ({live.length} of {MAX_LIVE_CHALLENGES})
          </span>
        </h2>
        <ChallengeList items={live} now={now} userId={user.id} empty="No live challenges." />
      </section>

      {finished.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">Finished</h2>
          <ChallengeList items={finished} now={now} userId={user.id} empty="" />
        </section>
      )}
    </main>
  );
}

function ChallengeList({
  items,
  now,
  userId,
  empty,
}: {
  items: { c: Challenge; state: ChallengeState }[];
  now: number;
  userId: string;
  empty: string;
}) {
  if (items.length === 0) return <p className="mt-2 text-muted">{empty}</p>;
  return (
    <ul className="mt-2 divide-y divide-black/5 rounded-2xl bg-surface shadow-sm ring-1 ring-black/5">
      {items.map(({ c, state }) => (
        <li key={c.id} className="p-4">
          <ChallengeSummary challenge={c} state={state} now={now} />
          {state === "waiting-for-host" && c.hostId === userId && (
            <div className="mt-3">
              <FirstGiftButton slug={c.slug} msLeft={hostGiftDeadline(c) - now} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ChallengeSummary({ challenge: c, state, now }: { challenge: Challenge; state: ChallengeState; now: number }) {
  const showMoney = state !== "pending" && state !== "declined";
  return (
    <Link href={`/c/${c.slug}`} className="group flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-bold group-hover:underline">{c.hostName}</p>
          {showMoney && <p className="whitespace-nowrap font-bold">{formatKES(c.raised)}</p>}
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {CHALLENGE_TYPES[c.type].name} · {durationLabel(c.durationMinutes)}
          {c.target !== null && <> · target {formatKES(c.target)}</>}
        </p>
        <p className="mt-1 text-sm">
          <StateLabel challenge={c} state={state} now={now} />
          {showMoney && (
            <span className="text-muted">
              {" "}· {c.donorCount.toLocaleString("en-KE")} {c.donorCount === 1 ? "donor" : "donors"}
            </span>
          )}
        </p>
      </div>
      <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-muted" aria-hidden="true">
        <path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

function StateLabel({ challenge: c, state, now }: { challenge: Challenge; state: ChallengeState; now: number }) {
  switch (state) {
    case "pending":
      return <span className="text-muted">Requested {new Date(c.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</span>;
    case "waiting-for-host":
      return (
        <span className="font-semibold">
          Waiting for host’s first gift · {formatTimeLeft(hostGiftDeadline(c) - now)} to give
        </span>
      );
    case "live":
      return <span className="font-semibold text-accent">Live · {formatTimeLeft(new Date(c.endsAt!).getTime() - now)} left</span>;
    case "ended":
      return <span className="text-muted">Ended</span>;
    case "expired":
      return <span className="text-muted">Expired: host didn’t give within 24 hours</span>;
    case "declined":
      return <span className="text-muted">Declined</span>;
  }
}
