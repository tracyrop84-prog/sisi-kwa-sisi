import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import DocumentsCheckedBadge from "@/components/DocumentsCheckedBadge";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getCampaignsAwaitingApproval, getCampaignsByIds, type Campaign } from "@/lib/campaigns";
import { getCampaignIdsWithDocuments } from "@/lib/documents";
import { formatKES } from "@/lib/format";
import { getCampaignsUnderReview, REPORT_REASONS, type CampaignUnderReview, type Report } from "@/lib/reports";
import AdminActions from "./AdminActions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin review · Sisi kwa Sisi" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  // Non-admins see a plain 404, so the page doesn't advertise itself.
  if (!(await isAdmin())) notFound();

  const [items, awaiting, withDocuments] = await Promise.all([
    getCampaignsUnderReview(),
    getCampaignsAwaitingApproval(),
    getCampaignIdsWithDocuments().then(getCampaignsByIds),
  ]);
  const pending = awaiting.filter((c) => c.status === "pending");
  const changesRequested = awaiting.filter((c) => c.status === "changes_requested");
  const awaitingBeneficiary = awaiting.filter((c) => c.status === "awaiting_beneficiary");
  // Pending ones are already listed above, with their documents.
  const toCheck = withDocuments.filter((c) => !c.documentsCheckedAt && c.status !== "closed" && c.status !== "pending");
  const paused = items.filter((x) => x.campaign.status === "paused");
  // Live or already completed by the organiser, with open reports.
  const reported = items.filter((x) => x.campaign.status === "active" || x.campaign.status === "completed");
  // The beneficiary said "This isn't me / I don't agree", which closed it.
  const declined = items.filter((x) => x.campaign.status === "closed" && x.campaign.beneficiaryDeclinedAt);
  const closed = items.filter((x) => x.campaign.status === "closed" && !x.campaign.beneficiaryDeclinedAt);

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Admin review</h1>
      <p className="mt-1 text-muted">Approvals, documents, and reported or paused harambees. Reporters are never shown.</p>

      {declined.length > 0 && (
        <ShortSection
          title="Declined by the beneficiary"
          note="The person it was for said it isn’t theirs or they don’t agree. Closed automatically; check the organiser."
          campaigns={declined.map((x) => x.campaign)}
          empty=""
        />
      )}
      <ShortSection title="Waiting for approval" campaigns={pending} empty="No harambees waiting for approval." />
      {changesRequested.length > 0 && (
        <ShortSection title="Changes requested" campaigns={changesRequested} empty="" />
      )}
      {awaitingBeneficiary.length > 0 && (
        <ShortSection title="Waiting for the beneficiary" campaigns={awaitingBeneficiary} empty="" />
      )}
      <ShortSection title="Documents to check" campaigns={toCheck} empty="No documents waiting to be checked." />

      <Section title="Paused" items={paused} empty="No paused harambees." />
      <Section title="Reported, not paused" items={reported} empty="No open reports on other harambees." />
      {closed.length > 0 && <Section title="Closed" items={closed} empty="" />}
    </main>
  );
}

// A campaign per row, linking to its review page (src/app/admin/campaigns/[id]).
type ShortSectionProps = { title: string; note?: string; campaigns: Campaign[]; empty: string };

function ShortSection({ title, note, campaigns, empty }: ShortSectionProps) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">
        {title} <span className="font-medium text-muted">({campaigns.length})</span>
      </h2>
      {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
      {campaigns.length === 0 ? (
        <p className="mt-2 text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/campaigns/${c.id}`}
                className="block rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5 active:scale-[0.99]"
              >
                <span className="block font-bold leading-snug text-accent">{c.title}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {c.category} · by {c.organiser} · goal {formatKES(c.goal)}
                </span>
                {c.beneficiaryIsMinor && (
                  <span className="mt-1 block text-sm font-semibold">For a child (under 18)</span>
                )}
                {c.beneficiaryDeclinedAt && (
                  <span className="mt-1 block text-sm font-semibold">Declined {shortDate(c.beneficiaryDeclinedAt)}</span>
                )}
                {c.status === "changes_requested" && c.changesRequestedReason && (
                  <span className="mt-1 block truncate text-sm">You asked: {c.changesRequestedReason}</span>
                )}
                {c.documentsCheckedAt && (
                  <span className="mt-1 block">
                    <DocumentsCheckedBadge small />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Section({ title, items, empty }: { title: string; items: CampaignUnderReview[]; empty: string }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">
        {title} <span className="font-medium text-muted">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.campaign.id} className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
              <CampaignReview item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CampaignReview({ item: { campaign: c, reports, openReports } }: { item: CampaignUnderReview }) {
  return (
    <>
      <Link href={`/admin/campaigns/${c.id}`} className="font-bold leading-snug text-accent hover:underline">
        {c.title}
      </Link>
      <p className="mt-0.5 text-sm text-muted">
        {c.category} · by {c.organiser} · {formatKES(c.raised)} from {c.donorCount.toLocaleString("en-KE")}{" "}
        {c.donorCount === 1 ? "donor" : "donors"}
      </p>
      <p className="mt-1 text-sm font-semibold">
        {c.status === "paused" && <>Paused {shortDate(c.pausedAt!)} · </>}
        {c.status === "closed" && <>Closed {shortDate(c.closedAt!)} · {formatKES(c.raised)} to be refunded · </>}
        {c.status === "completed" && <>Ended by organiser {shortDate(c.completedAt!)} · </>}
        {openReports} open {openReports === 1 ? "report" : "reports"}
      </p>

      {reports.length > 0 && (
        <ul className="mt-3 divide-y divide-black/5 rounded-xl bg-background ring-1 ring-black/5">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </ul>
      )}

      {c.status === "paused" && (
        <AdminActions
          campaignId={c.id}
          campaignSlug={c.slug}
          decisions={["clear", "fraud"]}
          clearLabel="Clear and resume"
          donorCount={c.donorCount}
        />
      )}
      {c.status === "completed" && (
        <AdminActions
          campaignId={c.id}
          campaignSlug={c.slug}
          decisions={["clear", "fraud"]}
          clearLabel="Dismiss reports"
          donorCount={c.donorCount}
        />
      )}
      {c.status === "active" && (
        <AdminActions
          campaignId={c.id}
          campaignSlug={c.slug}
          decisions={["pause", "clear", "fraud"]}
          clearLabel="Dismiss reports"
          donorCount={c.donorCount}
        />
      )}
    </>
  );
}

function ReportRow({ report: r }: { report: Report }) {
  return (
    <li className={`p-3 text-sm ${r.status === "resolved" ? "text-muted" : ""}`}>
      <p className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{REPORT_REASONS[r.reason]}</span>
        <span className="whitespace-nowrap text-xs text-muted">
          {r.resolution === "cleared" ? "Cleared · " : r.resolution === "fraud" ? "Fraud confirmed · " : ""}
          {shortDate(r.createdAt)}
        </span>
      </p>
      {r.details && <p className="mt-1 whitespace-pre-line break-words">{r.details}</p>}
    </li>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}
