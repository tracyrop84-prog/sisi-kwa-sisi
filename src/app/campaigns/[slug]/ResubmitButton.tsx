"use client";

import { useActionState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { resubmitAction, type ResubmitState } from "./actions";

const initialState: ResubmitState = {};

// After an admin requested changes: sends the harambee back for approval.
export default function ResubmitButton({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(resubmitAction, initialState);

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-accent px-4 py-3 font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {pending ? "Sending…" : "Resubmit for approval"}
      </button>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}
