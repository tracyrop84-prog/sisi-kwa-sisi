"use client";

import { useActionState, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { reviewCampaignAction, type AdminActionState } from "./actions";

const initialState: AdminActionState = {};

type Decision = "pause" | "clear" | "fraud";

type Props = {
  campaignId: string;
  campaignSlug: string;
  decisions: Decision[];
  clearLabel?: string; // "Clear and resume" for paused campaigns, "Dismiss reports" for live ones
  donorCount?: number; // for the fraud warning
};

export default function AdminActions({ campaignId, campaignSlug, decisions, clearLabel = "Clear", donorCount = 0 }: Props) {
  const [state, formAction, pending] = useActionState(reviewCampaignAction, initialState);
  // Confirming fraud can't be undone, so it takes a second tap.
  const [confirmingFraud, setConfirmingFraud] = useState(false);

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="campaignSlug" value={campaignSlug} />

      {confirmingFraud ? (
        <div className="rounded-xl bg-background p-3 ring-1 ring-black/15">
          <p className="text-sm font-bold">Close this harambee for good?</p>
          <p className="mt-1 text-sm text-muted">
            {donorCount === 0 ? (
              "It can never take donations."
            ) : (
              <>
                It stops taking donations permanently, and{" "}
                {donorCount === 1 ? "its 1 donation is" : `all ${donorCount.toLocaleString("en-KE")} donations are`}{" "}
                marked to be refunded.
              </>
            )}{" "}
            This can’t be undone.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmingFraud(false)}
              disabled={pending}
              className="rounded-xl bg-surface py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99] disabled:opacity-70"
            >
              Cancel
            </button>
            <button
              type="submit"
              name="decision"
              value="fraud"
              disabled={pending}
              className="rounded-xl bg-text py-3 font-bold text-white active:scale-[0.99] disabled:opacity-70"
            >
              {pending ? "Closing…" : "Yes, close it"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {decisions.includes("pause") && (
            <button
              type="submit"
              name="decision"
              value="pause"
              disabled={pending}
              className="flex-1 rounded-xl bg-surface px-3 py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99] disabled:opacity-70"
            >
              {pending ? "Saving…" : "Pause donations"}
            </button>
          )}
          {decisions.includes("clear") && (
            <button
              type="submit"
              name="decision"
              value="clear"
              disabled={pending}
              className="flex-1 rounded-xl bg-accent px-3 py-3 font-bold text-white active:scale-[0.99] disabled:opacity-70"
            >
              {clearLabel}
            </button>
          )}
          {decisions.includes("fraud") && (
            <button
              type="button"
              onClick={() => setConfirmingFraud(true)}
              disabled={pending}
              className="flex-1 rounded-xl bg-surface px-3 py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99] disabled:opacity-70"
            >
              Confirm fraud
            </button>
          )}
        </div>
      )}
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}
