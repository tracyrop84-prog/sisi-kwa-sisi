"use client";

import { useActionState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { reviewChallengeAction, type ReviewState } from "./actions";

const initialState: ReviewState = {};

type Props = { challengeId: string; campaignSlug: string };

export default function ReviewButtons({ challengeId, campaignSlug }: Props) {
  const [state, formAction, pending] = useActionState(reviewChallengeAction, initialState);

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="challengeId" value={challengeId} />
      <input type="hidden" name="campaignSlug" value={campaignSlug} />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="submit"
          name="decision"
          value="decline"
          disabled={pending}
          className="rounded-xl bg-surface py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99] disabled:opacity-70"
        >
          Decline
        </button>
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className="rounded-xl bg-accent py-3 font-bold text-white active:scale-[0.99] disabled:opacity-70"
        >
          {pending ? "Saving…" : "Approve"}
        </button>
      </div>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}
