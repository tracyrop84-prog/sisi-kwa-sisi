import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import UpdateForm from "../UpdateForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Post an update · Sisi kwa Sisi" };

type Props = { params: Promise<{ slug: string }> };

export default async function NewUpdatePage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/campaigns/${slug}/updates/new`);
  if (!user.emailConfirmed) redirect(`/check-email?next=${encodeURIComponent(`/campaigns/${slug}/updates/new`)}`);

  const campaign = await getCampaign(slug);
  // Only the organiser can post, and not once the campaign is closed; everyone else sees a plain 404.
  if (!campaign || campaign.organiserId !== user.id || campaign.status === "closed") notFound();

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <Link href={`/campaigns/${campaign.slug}`} className="text-sm font-semibold text-accent">
        ← Back to harambee
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">Post an update</h1>
      <p className="mt-1 mb-6 text-muted">
        Let donors to <span className="font-semibold text-text">{campaign.title}</span> know what’s happening.
      </p>
      <UpdateForm campaignId={campaign.id} campaignSlug={campaign.slug} category={campaign.category} />
    </main>
  );
}
