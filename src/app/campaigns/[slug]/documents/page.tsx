import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import DocumentList from "@/components/DocumentList";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import { DOCUMENT_SUGGESTIONS, MAX_DOCUMENTS } from "@/lib/documentRules";
import { getDocuments } from "@/lib/documents";
import DocumentUploader from "./DocumentUploader";
import RemoveDocumentButton from "./RemoveDocumentButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Supporting documents · Sisi kwa Sisi" };

type Props = { params: Promise<{ slug: string }> };

export default async function DocumentsPage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/campaigns/${slug}/documents`);

  const campaign = await getCampaign(slug);
  // Only the organiser; everyone else sees a plain 404.
  if (!campaign || campaign.organiserId !== user.id) notFound();
  const documents = await getDocuments([campaign.id]);
  // Same rule as documents_open in supabase/organiser_verification.sql.
  const editable = !campaign.documentsCheckedAt && campaign.status !== "closed";

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <Link href={`/campaigns/${campaign.slug}`} className="text-sm font-semibold text-accent">
        ← Back to harambee
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">Supporting documents</h1>
      <p className="mt-1 text-muted">
        Documents help our team confirm your harambee is genuine. They are private: only you and our team can see them,
        never donors.
      </p>

      {campaign.documentsCheckedAt ? (
        <p className="mt-4 rounded-2xl bg-accent/10 p-4 text-sm">
          <span className="font-bold">Documents checked ✓</span> Our team has checked your documents, so they can’t be
          changed any more.
        </p>
      ) : (
        <div className="mt-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <p className="font-bold">Good documents for {campaign.category.toLowerCase()} harambees</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {DOCUMENT_SUGGESTIONS[campaign.category].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">A clear photo taken with your phone is fine.</p>
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-bold">
          Your documents{" "}
          <span className="font-medium text-muted">
            ({documents.length}/{MAX_DOCUMENTS})
          </span>
        </h2>
        {documents.length > 0 ? (
          <div className="mt-2">
            <DocumentList
              documents={documents}
              action={editable ? (d) => <RemoveDocumentButton campaignSlug={campaign.slug} id={d.id} /> : undefined}
            />
          </div>
        ) : (
          <p className="mt-2 text-muted">No documents yet.</p>
        )}
        {editable && documents.length < MAX_DOCUMENTS && (
          <DocumentUploader campaignSlug={campaign.slug} slotsLeft={MAX_DOCUMENTS - documents.length} />
        )}
      </section>
    </main>
  );
}
