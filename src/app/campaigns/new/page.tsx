import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { CATEGORIES } from "@/lib/campaigns";
import CampaignForm from "./CampaignForm";

export const metadata: Metadata = { title: "Start a harambee · Sisi kwa Sisi" };

export default function NewCampaignPage() {
  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Start a harambee</h1>
      <p className="mt-1 mb-6 text-muted">It takes about two minutes.</p>
      <CampaignForm categories={CATEGORIES} />
    </main>
  );
}
