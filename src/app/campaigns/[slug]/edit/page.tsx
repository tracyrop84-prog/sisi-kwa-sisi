import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ErrorMessage from "@/components/ErrorMessage";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
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

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <Link href={`/campaigns/${campaign.slug}`} className="text-sm font-semibold text-accent">
        ← Back to harambee
      </Link>
      <h1 className="mt-3 mb-6 text-2xl font-extrabold leading-tight tracking-tight">Edit harambee</h1>
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
        initial={{ title: campaign.title, location: campaign.location, story: campaign.story }}
        coverPhoto={campaign.coverPhoto}
      />
    </main>
  );
}
