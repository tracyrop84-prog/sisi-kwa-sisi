import "server-only";
import { promises as fs } from "fs";
import path from "path";

// Sample data lives in data/campaigns.json until we move to Supabase.
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
  createdAt: string;
};

const DATA_FILE = path.join(process.cwd(), "data", "campaigns.json");

async function readAll(): Promise<Campaign[]> {
  return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
}

export async function getCampaigns(): Promise<Campaign[]> {
  const campaigns = await readAll();
  return campaigns.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCampaign(slug: string): Promise<Campaign | undefined> {
  return (await readAll()).find((c) => c.slug === slug);
}

export type NewCampaign = Pick<
  Campaign,
  "title" | "category" | "organiser" | "beneficiary" | "location" | "goal" | "story"
>;

export async function createCampaign(input: NewCampaign): Promise<Campaign> {
  const campaigns = await readAll();
  const campaign: Campaign = {
    ...input,
    slug: uniqueSlug(input.title, campaigns),
    raised: 0,
    donorCount: 0,
    createdAt: new Date().toISOString(),
  };
  campaigns.push(campaign);
  await fs.writeFile(DATA_FILE, JSON.stringify(campaigns, null, 2) + "\n");
  return campaign;
}

function uniqueSlug(title: string, existing: Campaign[]): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "harambee";
  let slug = base;
  for (let n = 2; existing.some((c) => c.slug === slug); n++) {
    slug = `${base}-${n}`;
  }
  return slug;
}
