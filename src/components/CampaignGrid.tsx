import CampaignCard from "@/components/CampaignCard";
import type { Campaign } from "@/lib/campaigns";

// One column on phones, 2 above 768px and 3 above 1100px.
export default function CampaignGrid({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 min-[1100px]:grid-cols-3">
      {campaigns.map((c) => (
        <li key={c.slug}>
          <CampaignCard campaign={c} />
        </li>
      ))}
    </ul>
  );
}
