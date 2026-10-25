"use client";

import { useActionState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { reportAction, type ReportFormState } from "./actions";

const initialState: ReportFormState = { errors: {}, values: {} };

type Props = {
  campaignSlug: string;
  from?: string;
  reasons: Record<string, string>; // code → label, from src/lib/reports.ts
  maxDetails: number;
};

export default function ReportForm({ campaignSlug, from, reasons, maxDetails }: Props) {
  const [state, formAction, pending] = useActionState(reportAction, initialState);
  const { errors, values, formError } = state;

  return (
    // key resets defaultValues after a failed submit so the user's input is kept
    <form action={formAction} key={JSON.stringify(values)} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="slug" value={campaignSlug} />
      {from && <input type="hidden" name="from" value={from} />}
      {formError && <ErrorMessage>{formError}</ErrorMessage>}

      <fieldset aria-describedby={errors.reason ? "reason-error" : undefined}>
        <legend className="font-semibold">What’s wrong?</legend>
        <div className="mt-2 flex flex-col gap-2">
          {Object.entries(reasons).map(([code, label]) => (
            <label
              key={code}
              className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-black/15 has-[:checked]:ring-2 has-[:checked]:ring-accent"
            >
              <input
                type="radio"
                name="reason"
                value={code}
                defaultChecked={values.reason === code}
                className="h-4 w-4 accent-accent"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {errors.reason && <ErrorMessage id="reason-error">{errors.reason}</ErrorMessage>}
      </fieldset>

      <div>
        <label htmlFor="details" className="font-semibold">
          Details <span className="font-normal text-muted">(optional)</span>
        </label>
        <p className="mt-0.5 text-sm text-muted">Anything that helps our team check, like what you know and how.</p>
        <textarea
          id="details"
          name="details"
          rows={5}
          maxLength={maxDetails}
          defaultValue={values.details}
          aria-invalid={errors.details ? true : undefined}
          aria-describedby={errors.details ? "details-error" : undefined}
          className="mt-2 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        {errors.details && <ErrorMessage id="details-error">{errors.details}</ErrorMessage>}
      </div>

      <p className="text-sm text-muted">
        Your report is anonymous: the organiser never sees who reported. If 3 people report a harambee, donations pause
        until our team has reviewed it.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-muted px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {pending ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}
