import "server-only";
import { createClient } from "@/lib/supabase/server";

// Donations live in the Supabase "donations" table (see supabase/donations.sql).
// Payments are MOCK: saving a row is the whole "payment". A database trigger
// adds each donation to the campaign's raised total and donor count.

export const MIN_DONATION = 10;
export const MAX_DONATION = 250_000; // M-Pesa per-transaction limit
export const MAX_MESSAGE = 280;
export const MAX_NAME = 60;

export type Donation = {
  id: string;
  donorName: string | null; // null = anonymous
  amount: number;
  message: string | null;
  createdAt: string;
};

export async function getDonations(campaignId: string, limit = 50): Promise<Donation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("donations")
    .select("id, donor_name, amount, message, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    donorName: r.donor_name,
    amount: r.amount,
    message: r.message,
    createdAt: r.created_at,
  }));
}

export type NewDonation = {
  campaignId: string;
  donorName: string | null;
  amount: number;
  message: string | null;
};

export async function createDonation(input: NewDonation): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("donations").insert({
    campaign_id: input.campaignId,
    donor_name: input.donorName,
    amount: input.amount,
    message: input.message,
  });
  if (error) throw error;
}
