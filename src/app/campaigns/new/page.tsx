import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { MAX_OPEN_CAMPAIGNS } from "@/lib/campaignRules";
import { countOpenCampaigns } from "@/lib/campaigns";
import CampaignForm from "./CampaignForm";

export const metadata: Metadata = { title: "Start a harambee · Sisi kwa Sisi" };

export default async function NewCampaignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signup?next=/campaigns/new");
  if (!user.emailConfirmed) redirect("/check-email?next=/campaigns/new");

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Start a harambee</h1>
      {(await countOpenCampaigns(user.id)) >= MAX_OPEN_CAMPAIGNS ? (
        <p className="mt-4 rounded-2xl bg-surface p-4 text-muted shadow-sm ring-1 ring-black/5">
          You already have {MAX_OPEN_CAMPAIGNS} active harambees, which is the most you can run at once.
        </p>
      ) : (
        <>
          <p className="mt-1 mb-6 text-muted">It takes about two minutes.</p>
          <CampaignForm organiserName={user.name} />
        </>
      )}
    </main>
  );
}
