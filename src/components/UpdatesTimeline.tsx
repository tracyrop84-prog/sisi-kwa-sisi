import Link from "next/link";
import Photo from "@/components/Photo";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { formatKES, timeAgo } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import type { Category } from "@/lib/categories";
import { RECOVERY_STATUSES, updateEmoji, updateLabel } from "@/lib/updateTypes";
import type { CampaignUpdate } from "@/lib/updates";
import { buildUpdateShare } from "@/lib/whatsapp";

const SHOWN = 5; // older updates fold away behind "Show N older updates"

type Props = {
  updates: CampaignUpdate[]; // newest first
  campaignTitle: string;
  campaignCategory: Category;
  campaignSlug: string;
  campaignUrl: string;
  isOrganiser: boolean;
};

export default function UpdatesTimeline({ updates, ...rest }: Props) {
  const recent = updates.slice(0, SHOWN);
  const older = updates.slice(SHOWN);

  return (
    <div className="mt-3">
      <ol className="relative space-y-4 border-l-2 border-accent/20 pl-5">
        {recent.map((u) => (
          <UpdateCard key={u.id} update={u} {...rest} />
        ))}
      </ol>
      {older.length > 0 && (
        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-center font-semibold text-accent group-open:hidden [&::-webkit-details-marker]:hidden">
            Show {older.length} older {older.length === 1 ? "update" : "updates"}
          </summary>
          <ol className="relative space-y-4 border-l-2 border-accent/20 pl-5">
            {older.map((u) => (
              <UpdateCard key={u.id} update={u} {...rest} />
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function UpdateCard({
  update: u,
  campaignTitle,
  campaignCategory,
  campaignSlug,
  campaignUrl,
  isOrganiser,
}: Omit<Props, "updates"> & { update: CampaignUpdate }) {
  const emoji = updateEmoji(u.type, campaignCategory);
  const label = updateLabel(u.type, campaignCategory);
  const edited = new Date(u.updatedAt).getTime() - new Date(u.createdAt).getTime() > 60_000;
  const share = buildUpdateShare({
    campaignTitle,
    category: campaignCategory,
    type: u.type,
    body: u.body,
    giftItem: u.giftItem,
    giftGiver: u.giftGiver,
    recoveryStatus: u.recoveryStatus,
    url: `${campaignUrl}#update-${u.id}`,
  });

  return (
    <li id={`update-${u.id}`} className="relative scroll-mt-4">
      <span
        className="absolute top-4 -left-[calc(2rem+1px)] flex h-6 w-6 items-center justify-center rounded-full bg-surface text-sm ring-2 ring-accent/20"
        aria-hidden="true"
      >
        {emoji}
      </span>
      <article className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-bold">{label}</h3>
          {u.recoveryStatus && (
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">
              {RECOVERY_STATUSES[u.recoveryStatus]}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          <time dateTime={u.createdAt}>{timeAgo(u.createdAt)}</time>
          {edited && " · Edited"}
        </p>

        {u.type === "gift" && (
          <div className="mt-3">
            <p className="text-lg font-bold leading-snug">{u.giftItem}</p>
            <p className="text-sm text-muted">
              {u.giftGiver ? <>Given by <span className="font-semibold text-text">{u.giftGiver}</span></> : "Given anonymously"}
            </p>
            {u.giftValue !== null && (
              <p className="mt-1 text-sm text-muted">
                Estimated value {formatKES(u.giftValue)} · not part of the cash raised
              </p>
            )}
          </div>
        )}

        {u.body && <p className="mt-3 whitespace-pre-line leading-relaxed">{u.body}</p>}

        {u.photos.length > 0 && (
          <ul className={`mt-3 grid gap-2 ${u.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {u.photos.map((path, i) => (
              <li key={path} className={u.photos.length === 3 && i === 0 ? "col-span-2" : undefined}>
                <a href={photoUrl(path)} target="_blank" rel="noopener noreferrer" className="block">
                  <Photo
                    path={path}
                    alt={`${label} photo ${i + 1} of ${u.photos.length}`}
                    className={`w-full rounded-xl ${u.photos.length === 1 ? "aspect-4/3" : "aspect-square"}`}
                  />
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <WhatsAppShareButton text={share} small />
          {isOrganiser && (
            <Link
              href={`/campaigns/${campaignSlug}/updates/${u.id}/edit`}
              className="text-sm font-semibold text-accent"
            >
              Edit
            </Link>
          )}
        </div>
      </article>
    </li>
  );
}
