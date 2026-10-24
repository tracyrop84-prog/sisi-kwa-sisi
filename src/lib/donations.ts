import "server-only";
import { createClient } from "@/lib/supabase/server";

// Donations live in the Supabase "donations" table (see supabase/donations.sql).
// Payments are MOCK: saving a row is the whole "payment". A database trigger
// adds each donation to the campaign's raised total and donor count.
// Challenge donations are the same rows with challenge_id set (see challenges.sql).

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

export function getDonations(campaignId: string, limit = 50): Promise<Donation[]> {
  return listDonations("campaign_id", campaignId, limit);
}

export function getChallengeDonations(challengeId: string, limit = 50): Promise<Donation[]> {
  return listDonations("challenge_id", challengeId, limit);
}

async function listDonations(
  column: "campaign_id" | "challenge_id",
  id: string,
  limit: number,
): Promise<Donation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("donations")
    .select("id, donor_name, amount, message, created_at")
    .eq(column, id)
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
  challengeId?: string | null;
};

// Raised by the challenge donation check in supabase/challenges.sql.
export type DonationError =
  | "challenge_not_found"
  | "challenge_not_live"
  | "waiting_for_host"
  | "challenge_expired"
  | "challenge_ended"
  | "below_preset";

const DB_ERRORS = new Set<string>([
  "challenge_not_found",
  "challenge_not_live",
  "waiting_for_host",
  "challenge_expired",
  "challenge_ended",
  "below_preset",
]);

export type DonateResult = { ok: true } | { error: DonationError };

export async function createDonation(input: NewDonation): Promise<DonateResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("donations").insert({
    campaign_id: input.campaignId,
    donor_name: input.donorName,
    amount: input.amount,
    message: input.message,
    // Only sent for challenge donations, so direct ones insert exactly as before.
    ...(input.challengeId ? { challenge_id: input.challengeId } : {}),
  });
  if (!error) return { ok: true };
  // Our database functions raise plain exceptions (code P0001) whose message is the error code.
  if (error.code === "P0001" && DB_ERRORS.has(error.message)) {
    return { error: error.message as DonationError };
  }
  throw error;
}
