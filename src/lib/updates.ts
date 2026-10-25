import "server-only";
import { PHOTO_BUCKET } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import {
  isRecoveryStatus,
  type RecoveryStatus,
  type UpdateType,
  type UpdateValues,
} from "@/lib/updateTypes";

// Campaign updates live in the "campaign_updates" table (see supabase/updates.sql).
// Row-level security lets only the campaign's organiser write them.

export type CampaignUpdate = {
  id: string;
  campaignId: string;
  type: UpdateType;
  body: string | null;
  giftItem: string | null;
  giftGiver: string | null; // null = Anonymous
  giftValue: number | null;
  recoveryStatus: RecoveryStatus | null;
  photos: string[];
  createdAt: string;
  updatedAt: string;
};

const COLUMNS =
  "id, campaign_id, type, body, gift_item, gift_giver, gift_value, recovery_status, photos, created_at, updated_at";

type Row = {
  id: string;
  campaign_id: string;
  type: UpdateType;
  body: string | null;
  gift_item: string | null;
  gift_giver: string | null;
  gift_value: number | null;
  recovery_status: RecoveryStatus | null;
  photos: string[];
  created_at: string;
  updated_at: string;
};

function fromRow(r: Row): CampaignUpdate {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    type: r.type,
    body: r.body,
    giftItem: r.gift_item,
    giftGiver: r.gift_giver,
    giftValue: r.gift_value,
    recoveryStatus: r.recovery_status,
    photos: r.photos,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Newest first.
export async function getUpdates(campaignId: string): Promise<CampaignUpdate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_updates")
    .select(COLUMNS)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function getUpdate(id: string): Promise<CampaignUpdate | undefined> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.from("campaign_updates").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : undefined;
}

// Each gift update counts as one gift. Gift values never count toward the cash raised.
export async function getGiftCount(campaignId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("campaign_updates")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("type", "gift");
  if (error) throw error;
  return count ?? 0;
}

// Turns checked form values into table columns. Fields that don't belong to
// the type are cleared, so switching the form around can't leave stray data.
function toColumns(type: UpdateType, v: UpdateValues, photos: string[]) {
  const gift = type === "gift";
  const value = v.giftValue.replace(/[,\s]/g, "");
  return {
    body: v.body.trim() || null,
    gift_item: gift ? v.giftItem.trim() : null,
    gift_giver: gift && !v.giftAnonymous ? v.giftGiver.trim() : null,
    gift_value: gift && value ? Number(value) : null,
    recovery_status: type === "recovery" && isRecoveryStatus(v.recoveryStatus) ? v.recoveryStatus : null,
    photos,
  };
}

export async function createUpdate(campaignId: string, type: UpdateType, v: UpdateValues, photos: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_updates")
    .insert({ campaign_id: campaignId, type, ...toColumns(type, v, photos) })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function editUpdate(update: CampaignUpdate, v: UpdateValues, photos: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaign_updates")
    .update(toColumns(update.type, v, photos))
    .eq("id", update.id);
  if (error) throw error;
}

export async function deleteUpdate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("campaign_updates").delete().eq("id", id);
  if (error) throw error;
}

// Best effort: a photo left behind only costs storage, so failures are logged, not shown.
export async function removePhotos(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) console.error("Couldn't remove photos:", error.message);
}
