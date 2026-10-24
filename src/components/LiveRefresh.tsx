"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Re-renders the page whenever someone donates, so the progress bar and donor
// list stay live for everyone who has the page open. On a challenge page it
// listens to that challenge's donations, and to the challenge itself so the
// page flips to live the moment it's approved or the host makes the first gift.
export default function LiveRefresh({ campaignId, challengeId }: { campaignId: string; challengeId?: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => router.refresh();
    const channel = supabase.channel(`donations:${challengeId ?? campaignId}`).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "donations",
        filter: challengeId ? `challenge_id=eq.${challengeId}` : `campaign_id=eq.${campaignId}`,
      },
      refresh,
    );
    if (challengeId) {
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "challenges", filter: `id=eq.${challengeId}` },
        refresh,
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, challengeId, router]);

  return null;
}
