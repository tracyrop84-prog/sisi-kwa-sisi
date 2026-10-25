import type { CampaignDocument } from "@/lib/documents";

type Props = {
  documents: CampaignDocument[];
  // Shown after each document, e.g. a remove button.
  action?: (doc: CampaignDocument) => React.ReactNode;
};

// Private documents with short-lived links. Used by the organiser's documents
// page and the admin review page.
export default function DocumentList({ documents, action }: Props) {
  return (
    <ul className="divide-y divide-black/5 rounded-xl bg-surface ring-1 ring-black/5">
      {documents.map((d) => (
        <li key={d.id} className="flex items-center gap-3 p-3">
          <span aria-hidden="true" className="text-xl">
            {d.contentType === "application/pdf" ? "📄" : "🖼️"}
          </span>
          <span className="min-w-0 flex-1">
            {d.url ? (
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate font-semibold text-accent hover:underline"
              >
                {d.fileName}
              </a>
            ) : (
              <span className="block truncate font-semibold">{d.fileName}</span>
            )}
            <span className="block text-xs text-muted">
              {d.url ? `${(d.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : "Upload didn’t finish"}
            </span>
          </span>
          {action?.(d)}
        </li>
      ))}
    </ul>
  );
}
