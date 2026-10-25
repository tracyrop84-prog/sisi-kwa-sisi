"use client";

import { useState, useTransition } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { deleteUpdateAction } from "./actions";

// Asks on the page itself, because the browser's confirm() popup doesn't work everywhere.
export default function DeleteUpdateButton({ campaignSlug, updateId }: { campaignSlug: string; updateId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [deleting, startDeleting] = useTransition();

  function remove() {
    startDeleting(async () => {
      // On success the server sends the browser back to the campaign page.
      const result = await deleteUpdateAction(campaignSlug, updateId);
      setError(result.error);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-xl bg-surface px-6 py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99]"
      >
        Delete update
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
      <p className="font-bold">Delete this update?</p>
      <p className="mt-1 text-sm text-muted">It and its photos will be removed for everyone. This can’t be undone.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="rounded-xl bg-surface py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99] disabled:opacity-70"
        >
          Keep it
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="rounded-xl bg-text py-3 font-bold text-white active:scale-[0.99] disabled:opacity-70"
        >
          {deleting ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}
