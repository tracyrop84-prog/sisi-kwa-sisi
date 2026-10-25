import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminActions from "@/app/admin/AdminActions";
import ApprovalActions from "@/app/admin/ApprovalActions";
import DocumentsCheckedButton from "@/app/admin/DocumentsCheckedButton";
import BeneficiaryVerifiedBadge from "@/components/BeneficiaryVerifiedBadge";
import DocumentList from "@/components/DocumentList";
import DocumentsCheckedBadge from "@/components/DocumentsCheckedBadge";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getBeneficiaryLink, getOtherCampaignIdsForPayoutPhone, getPayoutPhone } from "@/lib/beneficiaries";
import { MINOR_PHOTO_CONSENT } from "@/lib/campaignRules";
import { getCampaignById, getCampaignsByIds, type CampaignStatus } from "@/lib/campaigns";
import { getDocuments } from "@/lib/documents";
import { EDIT_FIELD_LABELS, getCampaignEdits, type CampaignEdit } from "@/lib/editHistory";
import { formatKES } from "@/lib/format";
import { formatKenyanPhone } from "@/lib/phone";
import { getVerifiedPhone } from "@/lib/verification";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Review harambee · Sisi kwa Sisi" };

type Props = { params: Promise<{ id: string }> };

const STATUS_LABELS: Record<CampaignStatus, string> = {
  active: "Live",
  paused: "Paused for review",
  closed: "Closed (fraud confirmed)",
  completed: "Completed by organiser",
  pending: "Waiting for approval",
  changes_requested: "Changes requested, waiting for the organiser",
  awaiting_beneficiary: "Waiting for the beneficiary to confirm",
};

// Everything an admin needs about one campaign: the organiser's verified
// phone, the beneficiary and payout number, approval, private documents and
// the full edit history.
export default async function AdminCampaignPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/admin/campaigns/${id}`);
  // Non-admins see a plain 404, so the page doesn't advertise itself.
  if (!(await isAdmin())) notFound();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const campaign = await getCampaignById(id);
  if (!campaign) notFound();
  const [phone, documents, edits, link, payout] = await Promise.all([
    campaign.organiserId ? getVerifiedPhone(campaign.organiserId) : null,
    getDocuments([campaign.id]),
    getCampaignEdits(campaign.id),
    campaign.beneficiaryConfirmation ? getBeneficiaryLink(campaign.id) : null,
    campaign.beneficiaryConfirmedAt ? getPayoutPhone(campaign.id) : null,
  ]);
  // Other harambees paid out to the same number, e.g. a repeat beneficiary or a copycat.
  const samePayout = payout
    ? await getOtherCampaignIdsForPayoutPhone(payout.phone, campaign.id).then(getCampaignsByIds)
    : [];
  const c = campaign;

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <Link href="/admin" className="text-sm font-semibold text-accent">
        ← Admin review
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">
        <Link href={`/campaigns/${c.slug}`} className="hover:underline">
          {c.title}
        </Link>
      </h1>
      <p className="mt-1 text-sm font-semibold">
        {c.beneficiaryDeclinedAt ? "Closed (declined by the beneficiary)" : STATUS_LABELS[c.status]}
      </p>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl bg-surface p-4 text-sm shadow-sm ring-1 ring-black/5">
        <dt className="text-muted">Category</dt>
        <dd>{c.category}</dd>
        <dt className="text-muted">Goal</dt>
        <dd>{formatKES(c.goal)}</dd>
        <dt className="text-muted">Raised</dt>
        <dd>
          {formatKES(c.raised)} from {c.donorCount.toLocaleString("en-KE")} {c.donorCount === 1 ? "donor" : "donors"}
        </dd>
        <dt className="text-muted">Organiser</dt>
        <dd>{c.organiser}</dd>
        <dt className="text-muted">Phone</dt>
        {/* Private: only the organiser and admins can read verified numbers. */}
        <dd>{phone ? `${formatKenyanPhone(phone)} ✓` : "Not verified"}</dd>
        <dt className="text-muted">For</dt>
        <dd>
          {c.beneficiary}
          {c.beneficiaryIsMinor && <span className="font-semibold"> · under 18</span>}
        </dd>
        <dt className="text-muted">Location</dt>
        <dd>{c.location}</dd>
        {c.viralVideoUrl && (
          <>
            <dt className="text-muted">Video</dt>
            <dd className="min-w-0 break-all">
              <a href={c.viralVideoUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline">
                {c.viralVideoUrl}
              </a>
            </dd>
          </>
        )}
        <dt className="text-muted">Started</dt>
        <dd>{shortDate(c.createdAt)}</dd>
      </dl>

      {c.status === "pending" && (
        <section className="mt-6 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="font-bold">Approval</h2>
          {c.beneficiaryIsMinor && (
            <p className="mt-1 rounded-xl bg-accent/10 px-3 py-2 text-sm">
              <span className="font-semibold">For a child.</span> Check the title, story, location and photos don’t show
              their school or where they live. The organiser accepted: “{MINOR_PHOTO_CONSENT}”
            </p>
          )}
          {c.changesRequestedReason ? (
            <p className="mt-1 text-sm">
              <span className="text-muted">Resubmitted. You asked: </span>
              <span className="whitespace-pre-line break-words">{c.changesRequestedReason}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted">Check the story and documents before approving.</p>
          )}
          <ApprovalActions campaignId={c.id} campaignSlug={c.slug} />
        </section>
      )}
      {c.status === "changes_requested" && (
        <section className="mt-6 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="font-bold">Changes requested</h2>
          <p className="mt-1 text-sm whitespace-pre-line break-words">{c.changesRequestedReason}</p>
          <p className="mt-2 text-sm text-muted">It comes back here once the organiser resubmits.</p>
        </section>
      )}
      {c.beneficiaryConfirmation && (
        <section className="mt-6 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="font-bold">{c.beneficiaryIsMinor ? "Parent or guardian" : "Beneficiary"}</h2>
          {payout ? (
            <>
              <p className="mt-2">
                <BeneficiaryVerifiedBadge name={c.beneficiaryConfirmedName} />
              </p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {payout.relationship && (
                  <>
                    <dt className="text-muted">Guardian</dt>
                    <dd>
                      {payout.name} ({payout.relationship})
                    </dd>
                  </>
                )}
                <dt className="text-muted">Payout number</dt>
                {/* Private: only admins can read payout numbers, and nobody can change them. */}
                <dd>{formatKenyanPhone(payout.phone)} ✓</dd>
                <dt className="text-muted">Confirmed</dt>
                <dd>{shortDate(payout.confirmedAt)}</dd>
              </dl>
              <p className="mt-3 text-sm font-semibold">
                Other harambees paid to this number: {samePayout.length}
              </p>
              {samePayout.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {samePayout.map((other) => (
                    <li key={other.id}>
                      <Link href={`/admin/campaigns/${other.id}`} className="font-semibold text-accent hover:underline">
                        {other.title}
                      </Link>{" "}
                      <span className="text-muted">
                        · {STATUS_LABELS[other.status]}
                        {other.viralVideoUrl ? " · viral" : ""} · {shortDate(other.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : link ? (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Name</dt>
              <dd>
                {link.name}
                {link.relationship && ` (${link.relationship})`}
              </dd>
              <dt className="text-muted">Number</dt>
              <dd>{formatKenyanPhone(link.phone)}</dd>
              <dt className="text-muted">{link.outcome === "declined" ? "Declined" : "Last SMS"}</dt>
              <dd>{shortDate(c.beneficiaryDeclinedAt ?? link.sentAt)}</dd>
            </dl>
          ) : (
            <p className="mt-1 text-sm text-muted">No confirmation SMS has been sent yet.</p>
          )}
        </section>
      )}
      {(c.status === "pending" ||
        c.status === "changes_requested" ||
        c.status === "awaiting_beneficiary" ||
        c.status === "active" ||
        c.status === "paused") && (
        <section className="mt-6 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="font-bold">Review</h2>
          <p className="mt-0.5 text-sm text-muted">
            {c.status === "paused" ? "Reports are on the admin dashboard." : "For fraud, not for changes."}
          </p>
          <AdminActions
            campaignId={c.id}
            campaignSlug={c.slug}
            decisions={c.status === "active" ? ["pause", "fraud"] : c.status === "paused" ? ["clear", "fraud"] : ["fraud"]}
            clearLabel="Clear and resume"
            donorCount={c.donorCount}
          />
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-bold">
          Documents <span className="font-medium text-muted">({documents.length})</span>
        </h2>
        {c.documentsCheckedAt && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <DocumentsCheckedBadge /> on {shortDate(c.documentsCheckedAt)}
          </p>
        )}
        {documents.length > 0 ? (
          <div className="mt-2">
            <DocumentList documents={documents} />
            <p className="mt-1 text-xs text-muted">Links work for 5 minutes. Refresh the page for new ones.</p>
          </div>
        ) : (
          <p className="mt-2 text-muted">No documents uploaded.</p>
        )}
        {documents.length > 0 && !c.documentsCheckedAt && c.status !== "closed" && (
          <DocumentsCheckedButton campaignId={c.id} campaignSlug={c.slug} />
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">
          Edit history <span className="font-medium text-muted">({edits.length})</span>
        </h2>
        <p className="mt-0.5 text-sm text-muted">Changes to the title, story or location after the first donation.</p>
        {edits.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-3">
            {edits.map((e) => (
              <EditRow key={e.id} edit={e} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">No edits.</p>
        )}
      </section>
    </main>
  );
}

function EditRow({ edit: e }: { edit: CampaignEdit }) {
  return (
    <li className="rounded-2xl bg-surface p-4 text-sm shadow-sm ring-1 ring-black/5">
      <p className="flex items-baseline justify-between gap-3">
        <span className="font-bold">{EDIT_FIELD_LABELS[e.field]}</span>
        <span className="whitespace-nowrap text-xs text-muted">
          {new Date(e.editedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
        </span>
      </p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Before</p>
      <p className="whitespace-pre-line break-words">{e.oldValue}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">After</p>
      <p className="whitespace-pre-line break-words">{e.newValue}</p>
    </li>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}
