"use client";

import { useActionState, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { closeHarambeeAction, type CloseState } from "./actions";

const initialState: CloseState = {};

type Props = { slug: string; finalTotal: string; liveChallenges: number };

// Closing can't be undone, so it takes a second tap.
export default function CloseHarambeeButton({ slug, finalTotal, liveChallenges }: Props) {
  const [state, formAction, pending] = useActionState(closeHarambeeAction, initialState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-muted underline-offset-2 hover:underline"
      >
        Close harambee
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/15">
      <input type="hidden" name="slug" value={slug} />
      <p className="font-bold">Close this harambee?</p>
      <p className="mt-1 text-sm text-muted">
        It stops taking donations for good, with a final total of {finalTotal}.
        {liveChallenges > 0 && (liveChallenges === 1 ? " The live challenge ends now." : " Live challenges end now.")}{" "}
        You can still post updates to thank donors and show how the money was used. This can’t be undone.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-xl bg-surface py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99] disabled:opacity-70"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-text py-3 font-bold text-white active:scale-[0.99] disabled:opacity-70"
        >
          {pending ? "Closing…" : "Yes, close it"}
        </button>
      </div>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}
