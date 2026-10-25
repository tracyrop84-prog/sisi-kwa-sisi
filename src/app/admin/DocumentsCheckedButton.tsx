"use client";

import { useActionState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { documentsCheckedAction, type AdminActionState } from "./actions";

const initialState: AdminActionState = {};

type Props = { campaignId: string; campaignSlug: string };

export default function DocumentsCheckedButton({ campaignId, campaignSlug }: Props) {
  const [state, formAction, pending] = useActionState(documentsCheckedAction, initialState);

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="campaignSlug" value={campaignSlug} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-accent px-4 py-3 font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {pending ? "Saving…" : "Mark documents checked"}
      </button>
      <p className="mt-1 text-center text-xs text-muted">
        Shows a badge on the harambee and locks the documents.
      </p>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}
