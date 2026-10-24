import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DonateForm from "@/app/campaigns/[slug]/donate/DonateForm";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { getCampaignById } from "@/lib/campaigns";
import { CHALLENGE_TYPES, challengeState, challengeTitle, durationLabel, firstName, getChallenge } from "@/lib/challenges";
import { MAX_MESSAGE, MAX_NAME } from "@/lib/donations";
import { formatKES } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const challenge = await getChallenge((await params).slug);
  return { title: challenge ? `Give to ${challengeTitle(challenge)} · Sisi kwa Sisi` : "Not found" };
}

export default async function ChallengeDonatePage({ params }: Props) {
  const challenge = await getChallenge((await params).slug);
  if (!challenge) notFound();
  const [campaign, user] = await Promise.all([getCampaignById(challenge.campaignId), getCurrentUser()]);
  if (!campaign) notFound();

  const state = challengeState(challenge);
  const firstGift = state === "waiting-for-host" && user?.id === challenge.hostId;
  const accepting = state === "live" || firstGift;
  const first = firstName(challenge.hostName);
  const type = CHALLENGE_TYPES[challenge.type];
  const preset = type.preset;

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <Link href={`/c/${challenge.slug}`} className="text-sm font-semibold text-accent">
        ← Back to challenge
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">{challengeTitle(challenge)}</h1>
      <p className="mt-1 text-sm text-muted">
        All money goes directly to <span className="font-semibold text-text">{campaign.title}</span>.
      </p>

      {accepting ? (
        <>
          <p className="mt-4 mb-6 rounded-2xl bg-accent/10 p-4 text-sm">
            {firstGift
              ? `Your gift starts the ${durationLabel(challenge.durationMinutes)} countdown. Then share the link!`
              : preset
                ? `This is a ${type.name}: give ${formatKES(preset)} or more.`
                : `Join ${first} as Mgeni Rasmi and give what you can.`}
          </p>
          <DonateForm
            slug={campaign.slug}
            challengeSlug={challenge.slug}
            maxMessage={MAX_MESSAGE}
            maxName={MAX_NAME}
            initialAmount={preset ?? undefined}
            quickAmounts={preset ? [preset, preset * 2, preset * 5, preset * 10] : undefined}
            submitLabel={firstGift ? "Make your first gift" : challenge.type === "mgeni_rasmi" ? `Sindikiza ${first}` : "Donate"}
            submitHint={challenge.type === "mgeni_rasmi" && !firstGift ? "Give with M-Pesa" : undefined}
          />
        </>
      ) : (
        <div className="mt-6 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <p className="font-bold">
            {state === "pending"
              ? "Waiting for organiser approval"
              : state === "waiting-for-host"
                ? `Waiting for ${first} to make the first gift`
                : "This challenge isn’t taking donations"}
          </p>
          <p className="mt-1 text-sm text-muted">You can still give to the harambee directly.</p>
          <Link
            href={`/campaigns/${campaign.slug}/donate`}
            className="mt-4 block w-full rounded-xl bg-primary px-6 py-3 text-center font-bold text-white active:scale-[0.99] hover:brightness-95"
          >
            Donate to the harambee
          </Link>
        </div>
      )}
    </main>
  );
}
