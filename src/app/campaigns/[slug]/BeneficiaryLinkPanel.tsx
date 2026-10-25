"use client";

import { useActionState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { formatKenyanPhone } from "@/lib/phone";
import { beneficiaryLinkAction, type BeneficiaryLinkState } from "./actions";

const initialState: BeneficiaryLinkState = {};

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

type Props = {
  slug: string;
  // null when no SMS has gone out yet (sending failed when the harambee was created).
  // sent and expires are already formatted, so server and browser agree.
  link: { name: string; phone: string; sent: string; expires: string; expired: boolean } | null;
};

// For the organiser while the harambee waits for its beneficiary to confirm.
export default function BeneficiaryLinkPanel({ slug, link }: Props) {
  const [state, formAction, pending] = useActionState(beneficiaryLinkAction, initialState);
  const editing = state.editing || !link;

  return (
    <div className="mt-2 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
      {link ? (
        <>
          <p className="font-bold">Waiting for {link.name} to confirm</p>
          <p className="mt-1 text-sm text-muted">
            We texted {formatKenyanPhone(link.phone)} on {link.sent}.{" "}
            {link.expired ? "The link has expired, so send a new one." : `The link works until ${link.expires}.`}{" "}
            Ask them to open it and enter the code.
          </p>
        </>
      ) : (
        <>
          <p className="font-bold">We couldn’t text the person you’re raising for</p>
          <p className="mt-1 text-sm text-muted">Enter their details to send the confirmation SMS.</p>
        </>
      )}
      {state.sentAt && (
        <p role="status" className="mt-2 text-sm font-semibold">
          SMS sent ✓
        </p>
      )}

      <form action={formAction} className="mt-3 flex flex-col gap-3" noValidate>
        <input type="hidden" name="slug" value={slug} />
        {editing ? (
          <>
            <div>
              <label htmlFor="beneficiary-link-name" className="text-sm font-semibold">Their full name</label>
              <input id="beneficiary-link-name" name="name" defaultValue={link?.name} className={inputClass} maxLength={100} />
            </div>
            <div>
              <label htmlFor="beneficiary-link-phone" className="text-sm font-semibold">Their phone number</label>
              <input
                id="beneficiary-link-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="0712 345 678"
                defaultValue={link ? formatKenyanPhone(link.phone) : undefined}
                className={inputClass}
              />
            </div>
            {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                name="intent"
                value="change"
                disabled={pending}
                className="rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white disabled:opacity-70"
              >
                {pending ? "Sending…" : "Send SMS"}
              </button>
              {link && (
                <button
                  type="submit"
                  name="intent"
                  value="cancel"
                  disabled={pending}
                  className="rounded-xl bg-surface px-3 py-3 text-sm font-semibold text-text ring-1 ring-black/15 disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
            </div>
            {link && <p className="text-xs text-muted">The old link stops working once a new one is sent.</p>}
          </>
        ) : (
          <>
            {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                name="intent"
                value="resend"
                disabled={pending}
                className="rounded-xl bg-surface px-3 py-3 text-sm font-semibold text-accent ring-1 ring-accent/40 disabled:opacity-60"
              >
                {pending ? "Sending…" : "Resend SMS"}
              </button>
              <button
                type="submit"
                name="intent"
                value="edit"
                disabled={pending}
                className="rounded-xl bg-surface px-3 py-3 text-sm font-semibold text-text ring-1 ring-black/15 disabled:opacity-60"
              >
                Change number
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
