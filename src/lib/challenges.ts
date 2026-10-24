import "server-only";
import { createClient } from "@/lib/supabase/server";

// Challenges live in the Supabase "challenges" table (see supabase/challenges.sql).
// The database enforces the rules (limits, approval, who can donate when); this
// file reads and writes challenges and turns database errors into codes.

export const CHALLENGE_TYPES = {
  mgeni_rasmi: {
    name: "Mgeni Rasmi",
    tagline: "Guest of the Day",
    description: "You give first, then share the link. The countdown starts with your gift.",
    preset: null,
  },
  ksh_100: {
    name: "KSh 100 Challenge",
    tagline: "Everyone gives KSh 100",
    description: "The donate amount starts at KSh 100. Donors can give more.",
    preset: 100, // also the minimum (enforced in challenges.sql)
  },
  ksh_50: {
    name: "KSh 50 Challenge",
    tagline: "Everyone gives KSh 50",
    description: "The donate amount starts at KSh 50. Donors can give more.",
    preset: 50,
  },
} as const;

export type ChallengeType = keyof typeof CHALLENGE_TYPES;

// Quick picks on the create form; hosts can also enter a custom duration.
export const QUICK_DURATIONS = [
  { minutes: 5 * 60, label: "5 hours" },
  { minutes: 24 * 60, label: "24 hours" },
  { minutes: 48 * 60, label: "48 hours" },
] as const;

export const DURATION_UNITS = {
  minutes: 1,
  hours: 60,
  days: 24 * 60,
} as const;

export type DurationUnit = keyof typeof DURATION_UNITS;

export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 30 * 24 * 60; // 30 days

export const MIN_TARGET = 100;
export const MAX_TARGET = 50_000_000;
export const MAX_LIVE_CHALLENGES = 5;
export const HOST_GIFT_WINDOW_MS = 24 * 60 * 60 * 1000; // Mgeni Rasmi host must give within 24h

export type Challenge = {
  id: string;
  slug: string;
  campaignId: string;
  hostId: string;
  hostName: string;
  type: ChallengeType;
  durationMinutes: number;
  target: number | null;
  status: "pending" | "approved" | "declined";
  approvedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  hostGift: number | null;
  createdAt: string;
  raised: number; // summed from donations
  donorCount: number;
};

// What a challenge looks like right now. Only status is stored; the rest
// depends on the clock.
export type ChallengeState =
  | "pending"
  | "declined"
  | "waiting-for-host" // approved Mgeni Rasmi, host hasn't given yet
  | "live"
  | "ended"
  | "expired"; // Mgeni Rasmi host didn't give within 24h

export function challengeState(c: Challenge, now = Date.now()): ChallengeState {
  if (c.status !== "approved") return c.status;
  if (c.endsAt) return new Date(c.endsAt).getTime() > now ? "live" : "ended";
  return hostGiftDeadline(c) > now ? "waiting-for-host" : "expired";
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}

// "Tracy's Mgeni Rasmi", "Tracy's KSh 100 Challenge"
export function challengeTitle(c: Challenge): string {
  return `${firstName(c.hostName)}’s ${CHALLENGE_TYPES[c.type].name}`;
}

export function hostGiftDeadline(c: Challenge): number {
  return new Date(c.approvedAt ?? c.createdAt).getTime() + HOST_GIFT_WINDOW_MS;
}

// "24 hours", "3 days", "2 days 6 hours", "1 hour 30 minutes"
export function durationLabel(minutes: number): string {
  const quick = QUICK_DURATIONS.find((d) => d.minutes === minutes);
  if (quick) return quick.label;

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  return [days && part(days, "day"), hours && part(hours, "hour"), mins && part(mins, "minute")]
    .filter(Boolean)
    .join(" ");
}

const COLUMNS =
  "id, slug, campaign_id, host_id, host_name, type, duration_minutes, target, status, approved_at, starts_at, ends_at, host_gift, created_at";

type Row = {
  id: string;
  slug: string;
  campaign_id: string;
  host_id: string;
  host_name: string;
  type: ChallengeType;
  duration_minutes: number;
  target: number | null;
  status: Challenge["status"];
  approved_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  host_gift: number | null;
  created_at: string;
};

type Totals = { raised: number; donorCount: number };

function fromRow(r: Row, totals: Totals = { raised: 0, donorCount: 0 }): Challenge {
  return {
    id: r.id,
    slug: r.slug,
    campaignId: r.campaign_id,
    hostId: r.host_id,
    hostName: r.host_name,
    type: r.type,
    durationMinutes: r.duration_minutes,
    target: r.target,
    status: r.status,
    approvedAt: r.approved_at,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    hostGift: r.host_gift,
    createdAt: r.created_at,
    ...totals,
  };
}

async function getTotals(ids: string[]): Promise<Map<string, Totals>> {
  const totals = new Map<string, Totals>();
  if (ids.length === 0) return totals;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenge_totals")
    .select("challenge_id, raised, donor_count")
    .in("challenge_id", ids);
  if (error) throw error;
  for (const t of data) totals.set(t.challenge_id, { raised: t.raised, donorCount: t.donor_count });
  return totals;
}

// Newest first.
export async function getCampaignChallenges(campaignId: string): Promise<Challenge[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select(COLUMNS)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data as Row[];
  const totals = await getTotals(rows.map((r) => r.id));
  return rows.map((r) => fromRow(r, totals.get(r.id)));
}

export async function getChallenge(slug: string): Promise<Challenge | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const row = data as Row;
  const totals = await getTotals([row.id]);
  return fromRow(row, totals.get(row.id));
}

// Error codes raised by supabase/challenges.sql, plus our own.
export type ChallengeError =
  | "not-logged-in"
  | "email-not-confirmed"
  | "campaign_not_found"
  | "no_organiser"
  | "already_hosting"
  | "mgeni_rasmi_taken"
  | "campaign_full"
  | "challenge_not_found"
  | "not_organiser"
  | "not_pending";

const DB_ERRORS = new Set<string>([
  "campaign_not_found",
  "no_organiser",
  "already_hosting",
  "mgeni_rasmi_taken",
  "campaign_full",
  "challenge_not_found",
  "not_organiser",
  "not_pending",
]);

// Our database functions raise plain exceptions (code P0001) whose message is the error code.
function knownError(error: { code?: string; message: string }): ChallengeError | null {
  return error.code === "P0001" && DB_ERRORS.has(error.message)
    ? (error.message as ChallengeError)
    : null;
}

export type NewChallenge = {
  campaignId: string;
  hostName: string;
  type: ChallengeType;
  durationMinutes: number;
  target: number | null;
};

export type CreateChallengeResult = { challenge: Challenge } | { error: ChallengeError };

export async function createChallenge(input: NewChallenge): Promise<CreateChallengeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-logged-in" };
  if (!user.email_confirmed_at) return { error: "email-not-confirmed" };

  // Slugs are random, so a clash is rare; just try again with a new one.
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await supabase
      .from("challenges")
      .insert({
        campaign_id: input.campaignId,
        slug: challengeSlug(input.hostName),
        host_name: input.hostName,
        type: input.type,
        duration_minutes: input.durationMinutes,
        target: input.target,
      })
      .select(COLUMNS)
      .single();
    if (!error) return { challenge: fromRow(data as Row) };
    if (error.code === "23505" && attempt < 4) continue; // unique slug violation
    const known = knownError(error);
    if (known) return { error: known };
    throw error;
  }
}

export type ReviewResult = { ok: true } | { error: ChallengeError };

export async function reviewChallenge(challengeId: string, approve: boolean): Promise<ReviewResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_challenge", {
    p_challenge_id: challengeId,
    p_approve: approve,
  });
  if (!error) return { ok: true };
  const known = knownError(error);
  if (known) return { error: known };
  throw error;
}

// Short and readable, e.g. "tracy-k7m2". No look-alike characters (0/o, 1/l/i).
function challengeSlug(hostName: string): string {
  const first =
    hostName
      .toLowerCase()
      .split(/\s+/)[0]
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20) || "challenge";
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${first}-${code}`;
}
