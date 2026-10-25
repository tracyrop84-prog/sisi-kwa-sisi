import "server-only";
import { createClient } from "@/lib/supabase/server";

// After a campaign's first donation, the database records every change to its
// title, story or location (see supabase/organiser_verification.sql). Only
// admins can read the history; the public only sees "Edited".

export type CampaignEdit = {
  id: number;
  field: "title" | "story" | "location";
  oldValue: string;
  newValue: string;
  editedAt: string;
};

export const EDIT_FIELD_LABELS: Record<CampaignEdit["field"], string> = {
  title: "Title",
  story: "Story",
  location: "Location",
};

// Newest first.
export async function getCampaignEdits(campaignId: string): Promise<CampaignEdit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_edits")
    .select("id, field, old_value, new_value, edited_at")
    .eq("campaign_id", campaignId)
    .order("edited_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return data.map((e) => ({
    id: e.id,
    field: e.field,
    oldValue: e.old_value,
    newValue: e.new_value,
    editedAt: e.edited_at,
  }));
}
