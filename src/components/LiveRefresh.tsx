"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Re-renders the campaign page whenever someone donates, so the progress bar
// and donor list stay live for everyone who has the page open.
export default function LiveRefresh({ campaignId }: { campaignId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`donations:${campaignId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "donations", filter: `campaign_id=eq.${campaignId}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, router]);

  return null;
}
