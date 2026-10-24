import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import {
  CHALLENGE_TYPES,
  DURATION_UNITS,
  durationLabel,
  MAX_DURATION_MINUTES,
  MAX_TARGET,
  MIN_DURATION_MINUTES,
  MIN_TARGET,
  QUICK_DURATIONS,
} from "@/lib/challenges";
import ChallengeForm from "./ChallengeForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const campaign = await getCampaign((await params).slug);
  return { title: campaign ? `Create a challenge for ${campaign.title} · Sisi kwa Sisi` : "Not found" };
}

export default async function NewChallengePage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/campaigns/${slug}/challenges/new`);
  if (!user.emailConfirmed) redirect(`/check-email?next=${encodeURIComponent(`/campaigns/${slug}/challenges/new`)}`);

  const campaign = await getCampaign(slug);
  if (!campaign) notFound();

  const isOrganiser = campaign.organiserId === user.id;

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <Link href={`/campaigns/${campaign.slug}`} className="text-sm font-semibold text-accent">
        ← Back to harambee
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">Create a challenge</h1>
      <p className="mt-1 text-muted">
        Rally your friends for <span className="font-semibold text-text">{campaign.title}</span>.
        All money goes directly to the harambee.
      </p>

      {campaign.organiserId ? (
        <>
          <p className="mt-4 mb-6 rounded-2xl bg-accent/10 p-4 text-sm">
            {isOrganiser
              ? "You’re the organiser, so your challenge goes live straight away."
              : "The organiser approves challenges before they go live. You’ll be able to share yours once it’s approved."}
          </p>
          <ChallengeForm
            campaignSlug={campaign.slug}
            types={CHALLENGE_TYPES}
            quickDurations={QUICK_DURATIONS}
            units={Object.keys(DURATION_UNITS)}
            durationRange={`${durationLabel(MIN_DURATION_MINUTES)} to ${durationLabel(MAX_DURATION_MINUTES)}`}
            minTarget={MIN_TARGET}
            maxTarget={MAX_TARGET}
          />
        </>
      ) : (
        <p className="mt-6 rounded-2xl bg-surface p-4 text-muted shadow-sm ring-1 ring-black/5">
          This harambee can’t take challenges because it has no organiser account to approve them.
        </p>
      )}
    </main>
  );
}
