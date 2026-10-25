import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser, isAdmin } from "@/lib/auth";
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

  const items = await getCampaignsUnderReview();
  const paused = items.filter((x) => x.campaign.status === "paused");
  // Live or already completed by the organiser, with open reports.
  const reported = items.filter((x) => x.campaign.status === "active" || x.campaign.status === "completed");
  const closed = items.filter((x) => x.campaign.status === "closed");

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Admin review</h1>
      <p className="mt-1 text-muted">Reported and paused harambees. Reporters are never shown.</p>

      <Section title="Paused" items={paused} empty="No paused harambees." />
      <Section title="Reported, not paused" items={reported} empty="No open reports on other harambees." />
      {closed.length > 0 && <Section title="Closed" items={closed} empty="" />}
    </main>
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
      <Link href={`/campaigns/${c.slug}`} className="font-bold leading-snug text-accent hover:underline">
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
