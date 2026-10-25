"use client";

import { useActionState, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { MAX_CHANGES_REASON } from "@/lib/campaignRules";
import { approvalAction, type AdminActionState } from "./actions";

const initialState: AdminActionState = {};

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

type Props = { campaignId: string; campaignSlug: string };

// For a campaign waiting for approval: approve it, or ask the organiser for
// changes with a reason they'll see. Fraud still goes through Confirm fraud.
export default function ApprovalActions({ campaignId, campaignSlug }: Props) {
  const [state, formAction, pending] = useActionState(approvalAction, initialState);
  const [requesting, setRequesting] = useState(false);

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="campaignSlug" value={campaignSlug} />

      {requesting ? (
        <div className="rounded-xl bg-background p-3 ring-1 ring-black/15">
          <label htmlFor="reason" className="text-sm font-bold">
            What should the organiser change?
          </label>
          <p className="text-sm text-muted">They’ll see this on their harambee.</p>
          <textarea
            id="reason"
            name="reason"
            required
            maxLength={MAX_CHANGES_REASON}
            rows={4}
            placeholder="e.g. Please upload the hospital quotation for the surgery."
            className={inputClass}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRequesting(false)}
              disabled={pending}
              className="rounded-xl bg-surface py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99] disabled:opacity-70"
            >
              Cancel
            </button>
            <button
              type="submit"
              name="decision"
              value="changes"
              disabled={pending}
              className="rounded-xl bg-accent py-3 font-bold text-white active:scale-[0.99] disabled:opacity-70"
            >
              {pending ? "Sending…" : "Send request"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="decision"
            value="approve"
            disabled={pending}
            className="flex-1 rounded-xl bg-accent px-3 py-3 font-bold text-white active:scale-[0.99] disabled:opacity-70"
          >
            {pending ? "Saving…" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => setRequesting(true)}
            disabled={pending}
            className="flex-1 rounded-xl bg-surface px-3 py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99] disabled:opacity-70"
          >
            Request changes
          </button>
        </div>
      )}
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}
