"use client";

import { useState, useTransition } from "react";
import { removeDocumentAction } from "./actions";

export default function RemoveDocumentButton({ campaignSlug, id }: { campaignSlug: string; id: string }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setFailed(!!(await removeDocumentAction(campaignSlug, id)).error);
        })
      }
      className="shrink-0 text-sm font-semibold text-muted underline-offset-2 hover:underline disabled:opacity-60"
    >
      {pending ? "Removing…" : failed ? "Try again" : "Remove"}
    </button>
  );
}
