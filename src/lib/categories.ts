// Campaign categories, each with an icon for the create form and the label its
// progress updates use. Medical campaigns get recovery updates instead of
// progress updates. Keep in sync with the category check in supabase/campaigns.sql.

export const CATEGORY_INFO = {
  Medical: { icon: "🏥", progress: null },
  Education: { icon: "📚", progress: "Building progress" },
  "School Fees": { icon: "🎓", progress: "School progress" },
  Funeral: { icon: "🕊️", progress: "Arrangements" },
  Wedding: { icon: "💍", progress: "Wedding preparations" },
  Emergency: { icon: "🚨", progress: "Rebuilding progress" },
  Community: { icon: "🤝", progress: "Building progress" },
  "Church & Faith": { icon: "⛪", progress: "Building progress" },
  "Business & Empowerment": { icon: "💼", progress: "Business progress" },
  Farming: { icon: "🌱", progress: "Farm progress" },
  Housing: { icon: "🏠", progress: "Building progress" },
  "Sports & Youth": { icon: "⚽", progress: "Team progress" },
  "Elder Care": { icon: "🧓", progress: "Care updates" },
  Other: { icon: "✨", progress: "Progress" },
} as const satisfies Record<string, { icon: string; progress: string | null }>;

export type Category = keyof typeof CATEGORY_INFO;

export const CATEGORIES = Object.keys(CATEGORY_INFO) as Category[];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && Object.hasOwn(CATEGORY_INFO, value);
}
