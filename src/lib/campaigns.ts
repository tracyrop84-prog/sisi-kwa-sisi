import "server-only";
import { createClient } from "@/lib/supabase/server";

// Campaigns live in the Supabase "campaigns" table (see supabase/campaigns.sql).
// Everything that reads or writes campaigns goes through this file.

export const CATEGORIES = [
  "Medical",
  "Education",
  "Funeral",
  "Emergency",
  "Community",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Campaign = {
  id: string;
  slug: string;
  title: string;
  category: Category;
  organiser: string;
  beneficiary: string;
  location: string;
  goal: number;
  raised: number;
  donorCount: number;
  story: string;
  organiserId: string | null; // null for seeded sample campaigns
  createdAt: string;
};

const COLUMNS =
  "id, slug, title, category, organiser, beneficiary, location, goal, raised, donor_count, story, organiser_id, created_at";

type Row = {
  id: string;
  slug: string;
  title: string;
  category: Category;
  organiser: string;
  beneficiary: string;
  location: string;
  goal: number;
  raised: number;
  donor_count: number;
  story: string;
  organiser_id: string | null;
  created_at: string;
};

function fromRow({ donor_count, organiser_id, created_at, ...rest }: Row): Campaign {
  return { ...rest, donorCount: donor_count, organiserId: organiser_id, createdAt: created_at };
}

export async function getCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function getCampaign(slug: string): Promise<Campaign | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : undefined;
}

export async function getCampaignById(id: string): Promise<Campaign | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : undefined;
}

export type NewCampaign = Pick<
  Campaign,
  "title" | "category" | "organiser" | "beneficiary" | "location" | "goal" | "story"
>;

export type CreateResult = { campaign: Campaign } | { error: "not-logged-in" };

export async function createCampaign(input: NewCampaign): Promise<CreateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-logged-in" };

  const { data, error } = await supabase
    .from("campaigns")
    .insert({ ...input, slug: await uniqueSlug(input.title), organiser_id: user.id })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return { campaign: fromRow(data as Row) };
}

async function uniqueSlug(title: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "harambee";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("slug")
    .like("slug", `${base}%`);
  if (error) throw error;
  const taken = new Set(data.map((r) => r.slug));

  let slug = base;
  for (let n = 2; taken.has(slug); n++) {
    slug = `${base}-${n}`;
  }
  return slug;
}
