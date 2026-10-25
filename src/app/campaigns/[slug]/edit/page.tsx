import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ErrorMessage from "@/components/ErrorMessage";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { NEW_ORGANISER_MAX_GOAL } from "@/lib/campaignRules";
import { canEditDetails, getCampaign, isTrustedOrganiser } from "@/lib/campaigns";
import EditCampaignForm from "./EditCampaignForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit harambee · Sisi kwa Sisi" };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cover?: string }>;
};

export default async function EditCampaignPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/campaigns/${slug}/edit`);

  const campaign = await getCampaign(slug);
  // Only the organiser can edit; everyone else sees a plain 404.
  if (!campaign || campaign.organiserId !== user.id) notFound();
  const { cover } = await searchParams;
  // The goal can only change while an admin has requested changes (supabase/goal_edits.sql).
  const goal =
    campaign.status === "changes_requested"
      ? { initial: campaign.goal, maxGoal: (await isTrustedOrganiser(user.id)) ? null : NEW_ORGANISER_MAX_GOAL }
      : undefined;

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <Link href={`/campaigns/${campaign.slug}`} className="text-sm font-semibold text-accent">
        ← Back to harambee
      </Link>
      <h1 className="mt-3 mb-6 text-2xl font-extrabold leading-tight tracking-tight">Edit harambee</h1>
      {!canEditDetails(campaign.status) ? (
        <p className="rounded-2xl bg-surface p-4 text-muted shadow-sm ring-1 ring-black/5">
          {campaign.status === "paused"
            ? "You can’t edit this harambee while it’s under review."
            : campaign.status === "awaiting_beneficiary"
              ? "You can’t edit this harambee while we wait for the person it’s for to confirm it."
              : campaign.status === "completed"
                ? "This harambee has ended, so its details can’t be changed. You can still post updates."
                : "This harambee has been closed and can’t be edited."}
        </p>
      ) : (
        <>
          {campaign.status === "changes_requested" && campaign.changesRequestedReason && (
            <div className="mb-5 rounded-2xl bg-accent/10 p-4">
              <p className="font-bold">What our team asked you to change</p>
              <p className="mt-1 text-sm whitespace-pre-line break-words">{campaign.changesRequestedReason}</p>
              <p className="mt-2 text-sm text-muted">After saving, resubmit it from your harambee page.</p>
            </div>
          )}
          {campaign.donorCount > 0 && (
            <p className="mb-5 text-sm text-muted">
              Donors can see that the harambee was edited, and our team keeps a record of every change.
            </p>
          )}
          {campaign.beneficiaryConfirmedAt && (
            <p className="mb-5 text-sm text-muted">
              If you change the story or goal, we’ll text{" "}
              {campaign.beneficiaryConfirmedName ?? "the child’s parent or guardian"} to let them know.
            </p>
          )}
          {campaign.beneficiaryIsMinor && (
            <p className="mb-5 text-sm text-muted">
              Don’t add the name of the child’s school or where they live. A town or county is enough.
            </p>
          )}
          {cover === "failed" && (
            <div className="mb-5">
              <ErrorMessage>
                Your harambee was created, but the cover photo didn’t upload. Add it again below.
              </ErrorMessage>
            </div>
          )}
          <EditCampaignForm
            campaignId={campaign.id}
            campaignSlug={campaign.slug}
            initial={{
              title: campaign.title,
              beneficiary: campaign.beneficiary,
              location: campaign.location,
              story: campaign.story,
            }}
            beneficiaryLocked={campaign.donorCount > 0 || campaign.beneficiaryConfirmedAt !== null}
            coverPhoto={campaign.coverPhoto}
            goal={goal}
          />
        </>
      )}
    </main>
  );
}
