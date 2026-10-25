import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { MAX_OPEN_CAMPAIGNS, NEW_ORGANISER_MAX_GOAL } from "@/lib/campaignRules";
import { countOpenCampaigns, isTrustedOrganiser } from "@/lib/campaigns";
import { getVerifiedPhone } from "@/lib/verification";
import CampaignForm from "./CampaignForm";

export const metadata: Metadata = { title: "Start a harambee · Sisi kwa Sisi" };

export default async function NewCampaignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signup?next=/campaigns/new");
  if (!user.emailConfirmed) redirect("/check-email?next=/campaigns/new");
  const [phone, openCampaigns, trusted] = await Promise.all([
    getVerifiedPhone(user.id),
    countOpenCampaigns(user.id),
    isTrustedOrganiser(user.id),
  ]);

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Start a harambee</h1>
      {openCampaigns >= MAX_OPEN_CAMPAIGNS ? (
        <p className="mt-4 rounded-2xl bg-surface p-4 text-muted shadow-sm ring-1 ring-black/5">
          You already have {MAX_OPEN_CAMPAIGNS} active harambees, which is the most you can run at once.
        </p>
      ) : !phone ? (
        <div className="mt-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <p className="font-bold">First, verify your phone number</p>
          <p className="mt-1 text-sm text-muted">
            Every organiser verifies a Kenyan phone number with a code by SMS. It only takes a minute, and only you and
            our team can see it.
          </p>
          <Link
            href="/verify-phone?next=/campaigns/new"
            className="mt-4 block w-full rounded-xl bg-accent px-6 py-3 text-center font-bold text-white active:scale-[0.99]"
          >
            Verify phone number
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-1 mb-6 text-muted">It takes about two minutes.</p>
          <CampaignForm organiserName={user.name} maxGoal={trusted ? null : NEW_ORGANISER_MAX_GOAL} />
        </>
      )}
    </main>
  );
}
