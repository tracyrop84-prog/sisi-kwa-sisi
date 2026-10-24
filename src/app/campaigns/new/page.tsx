import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/campaigns";
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
      <p className="mt-1 mb-6 text-muted">It takes about two minutes.</p>
      <CampaignForm categories={CATEGORIES} organiserName={user.name} />
    </main>
  );
}
