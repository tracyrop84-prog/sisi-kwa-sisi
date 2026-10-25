import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import { getUpdate } from "@/lib/updates";
import DeleteUpdateButton from "../../DeleteUpdateButton";
import UpdateForm from "../../UpdateForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit update · Sisi kwa Sisi" };

type Props = { params: Promise<{ slug: string; id: string }> };

export default async function EditUpdatePage({ params }: Props) {
  const { slug, id } = await params;
  const path = `/campaigns/${slug}/updates/${id}/edit`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!user.emailConfirmed) redirect(`/check-email?next=${encodeURIComponent(path)}`);

  const [campaign, update] = await Promise.all([getCampaign(slug), getUpdate(id)]);
  if (
    !campaign ||
    campaign.organiserId !== user.id ||
    campaign.status === "closed" ||
    !update ||
    update.campaignId !== campaign.id
  ) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <Link href={`/campaigns/${campaign.slug}#update-${update.id}`} className="text-sm font-semibold text-accent">
        ← Back to harambee
      </Link>
      <h1 className="mt-3 mb-6 text-2xl font-extrabold leading-tight tracking-tight">Edit update</h1>
      <UpdateForm
        campaignId={campaign.id}
        campaignSlug={campaign.slug}
        category={campaign.category}
        updateId={update.id}
        initial={{
          type: update.type,
          body: update.body ?? "",
          giftItem: update.giftItem ?? "",
          giftGiver: update.giftGiver ?? "",
          giftAnonymous: update.type === "gift" && update.giftGiver === null,
          giftValue: update.giftValue?.toString() ?? "",
          recoveryStatus: update.recoveryStatus ?? "",
          consent: false, // asked again, since edits can add new photos
        }}
        initialPhotos={update.photos}
      />
      <div className="mt-8 border-t border-black/10 pt-6">
        <DeleteUpdateButton campaignSlug={campaign.slug} updateId={update.id} />
      </div>
    </main>
  );
}
