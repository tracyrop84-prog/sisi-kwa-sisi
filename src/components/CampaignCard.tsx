import Link from "next/link";
import BeneficiaryVerifiedBadge from "@/components/BeneficiaryVerifiedBadge";
import DocumentsCheckedBadge from "@/components/DocumentsCheckedBadge";
import Photo from "@/components/Photo";
import ProgressBar from "@/components/ProgressBar";
import type { Campaign } from "@/lib/campaigns";
import { CATEGORY_INFO } from "@/lib/categories";

export default function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      className="block h-full overflow-hidden rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5 active:scale-[0.99]"
    >
      {campaign.coverPhoto ? (
        <Photo path={campaign.coverPhoto} alt="" className="-mx-4 -mt-4 mb-3 block aspect-video w-[calc(100%+2rem)] max-w-none rounded-t-2xl" />
      ) : (
        // Same size as a cover photo, so cards line up in the grid.
        <div
          aria-hidden="true"
          className="-mx-4 -mt-4 mb-3 flex aspect-video w-[calc(100%+2rem)] items-center justify-center rounded-t-2xl bg-accent/10 text-5xl"
        >
          {CATEGORY_INFO[campaign.category].icon}
        </div>
      )}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {campaign.category} · {campaign.location}
      </p>
      {campaign.status === "paused" && (
        <p className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
          Under review · donations paused
        </p>
      )}
      {campaign.status === "completed" && (
        <p className="mt-1 inline-block rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-muted">
          Completed · thank you 🙏
        </p>
      )}
      {campaign.status === "pending" && (
        <p className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
          Waiting for approval
        </p>
      )}
      {campaign.status === "awaiting_beneficiary" && (
        <p className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
          Waiting for confirmation
        </p>
      )}
      {campaign.status === "changes_requested" && (
        <p className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
          Changes requested
        </p>
      )}
      <h2 className="mt-1 text-lg font-bold leading-snug">{campaign.title}</h2>
      {campaign.status !== "closed" && (campaign.beneficiaryConfirmedAt || campaign.documentsCheckedAt) && (
        <p className="mt-1 flex flex-wrap gap-1">
          {campaign.beneficiaryConfirmedAt && <BeneficiaryVerifiedBadge name={campaign.beneficiaryConfirmedName} small />}
          {campaign.documentsCheckedAt && <DocumentsCheckedBadge small />}
        </p>
      )}
      <div className="mt-3">
        <ProgressBar
          raised={campaign.raised}
          goal={campaign.goal}
          donorCount={campaign.donorCount}
        />
      </div>
    </Link>
  );
}
