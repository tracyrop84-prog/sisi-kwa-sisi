"use client";

import { useActionState, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { donateAction, type DonateState } from "./actions";

const initialState: DonateState = { errors: {}, values: {} };

const DEFAULT_QUICK_AMOUNTS = [200, 500, 1000, 2000];

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:bg-black/5 disabled:text-muted";

type Props = {
  slug: string;
  maxMessage: number;
  maxName: number;
  // Challenge donations only:
  challengeSlug?: string;
  initialAmount?: number; // e.g. 100 for a KSh 100 Challenge
  quickAmounts?: number[];
  submitLabel?: string; // e.g. "Sindikiza Tracy"
  submitHint?: string; // smaller line inside the button, e.g. "Give with M-Pesa"
};

export default function DonateForm({
  slug,
  maxMessage,
  maxName,
  challengeSlug,
  initialAmount,
  quickAmounts = DEFAULT_QUICK_AMOUNTS,
  submitLabel = "Donate",
  submitHint,
}: Props) {
  const [state, formAction, pending] = useActionState(donateAction, initialState);
  const { errors, values, formError } = state;
  const hasErrors = Object.keys(errors).length > 0;

  // Controlled so quick-amount buttons can fill it, and so it survives a failed submit.
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "");
  const [anonymous, setAnonymous] = useState(false);

  const field = (name: keyof DonateState["errors"]) => ({
    name,
    id: name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    // key resets defaultValues after a failed submit so the user's input is kept
    <form action={formAction} key={JSON.stringify(values)} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="slug" value={slug} />
      {challengeSlug && <input type="hidden" name="challenge" value={challengeSlug} />}
      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      {hasErrors && <ErrorMessage>Please fix the highlighted fields below.</ErrorMessage>}

      <div>
        <label htmlFor="amount" className="font-semibold">Amount (KES)</label>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {quickAmounts.map((a) => {
            const selected = amount === String(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(String(a))}
                aria-pressed={selected}
                className={`rounded-xl py-3 text-sm font-bold ring-1 ${
                  selected ? "bg-accent text-white ring-accent" : "bg-surface text-text ring-black/15"
                }`}
              >
                {a.toLocaleString("en-KE")}
              </button>
            );
          })}
        </div>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute top-1/2 left-4 mt-0.5 -translate-y-1/2 text-muted">KES</span>
          <input
            {...field("amount")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputClass} pl-14`}
            inputMode="numeric"
            placeholder="Other amount"
          />
        </div>
        {errors.amount && <ErrorMessage id="amount-error">{errors.amount}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="donorName" className="font-semibold">Your name</label>
        <input
          {...field("donorName")}
          defaultValue={values.donorName}
          disabled={anonymous}
          className={inputClass}
          autoComplete="name"
          maxLength={maxName}
        />
        {errors.donorName && <ErrorMessage id="donorName-error">{errors.donorName}</ErrorMessage>}
        <label className="mt-3 flex items-center gap-3">
          <input
            type="checkbox"
            name="anonymous"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-5 w-5 accent-accent"
          />
          <span>Give anonymously</span>
        </label>
        {anonymous && (
          <p className="mt-1 text-sm text-muted">Your name won’t be saved or shown.</p>
        )}
      </div>

      <div>
        <label htmlFor="message" className="font-semibold">
          Message <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          {...field("message")}
          defaultValue={values.message}
          className={`${inputClass} min-h-24`}
          rows={3}
          maxLength={maxMessage}
          placeholder="Words of encouragement"
        />
        {errors.message && <ErrorMessage id="message-error">{errors.message}</ErrorMessage>}
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
        >
          {pending ? "Donating…" : submitLabel}
          {submitHint && !pending && (
            <span className="block text-xs font-semibold opacity-90">{submitHint}</span>
          )}
        </button>
        <p className="mt-2 text-center text-xs text-muted">
          Test mode: no money is charged. M-Pesa is coming soon.
        </p>
      </div>
    </form>
  );
}
