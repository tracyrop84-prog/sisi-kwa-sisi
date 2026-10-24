"use client";

import { useActionState, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { createChallengeAction, type ChallengeFormState } from "./actions";

const initialState: ChallengeFormState = { errors: {}, values: { duration: "1440", durationUnit: "hours" } };

const controlClass =
  "rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
const inputClass = `mt-1 block w-full ${controlClass}`;

// A radio styled as a card; the ring turns blue when picked.
const optionClass =
  "block cursor-pointer rounded-xl bg-surface ring-1 ring-black/15 has-[:checked]:ring-2 has-[:checked]:ring-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50";

type Props = {
  campaignSlug: string;
  types: Record<string, { name: string; tagline: string; description: string }>;
  quickDurations: readonly { minutes: number; label: string }[];
  units: string[];
  durationRange: string; // "30 minutes to 30 days"
  minTarget: number;
  maxTarget: number;
};

export default function ChallengeForm({
  campaignSlug,
  types,
  quickDurations,
  units,
  durationRange,
  minTarget,
  maxTarget,
}: Props) {
  const [state, formAction, pending] = useActionState(createChallengeAction, initialState);
  const { errors, values, formError } = state;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    // key resets defaultValues after a failed submit so the user's input is kept
    <form action={formAction} key={JSON.stringify(values)} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="slug" value={campaignSlug} />
      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      {hasErrors && <ErrorMessage>Please fix the highlighted fields below.</ErrorMessage>}

      <fieldset aria-describedby={errors.type ? "type-error" : undefined}>
        <legend className="font-semibold">Challenge type</legend>
        <div className="mt-2 flex flex-col gap-2">
          {Object.entries(types).map(([value, t]) => (
            <label key={value} className={`${optionClass} flex gap-3 p-4`}>
              <input
                type="radio"
                name="type"
                value={value}
                defaultChecked={values.type === value}
                className="mt-1 h-5 w-5 shrink-0 accent-accent"
              />
              <span>
                <span className="block font-bold">
                  {t.name} <span className="font-medium text-muted">· {t.tagline}</span>
                </span>
                <span className="mt-0.5 block text-sm text-muted">{t.description}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.type && <ErrorMessage id="type-error">{errors.type}</ErrorMessage>}
      </fieldset>

      <DurationPicker
        quickDurations={quickDurations}
        units={units}
        durationRange={durationRange}
        values={values}
        errors={errors}
      />

      <div>
        <label htmlFor="target" className="font-semibold">
          Target <span className="font-normal text-muted">(optional)</span>
        </label>
        <p className="text-sm text-muted">
          How much you hope your challenge raises. Leave empty to show the whole harambee’s progress.
        </p>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 mt-0.5 -translate-y-1/2 text-muted">KES</span>
          <input
            name="target"
            id="target"
            defaultValue={values.target}
            aria-invalid={errors.target ? true : undefined}
            aria-describedby={errors.target ? "target-error" : undefined}
            className={`${inputClass} pl-14`}
            inputMode="numeric"
            placeholder={`e.g. ${(5000).toLocaleString("en-KE")}`}
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          KES {minTarget.toLocaleString("en-KE")} to KES {maxTarget.toLocaleString("en-KE")}
        </p>
        {errors.target && <ErrorMessage id="target-error">{errors.target}</ErrorMessage>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {pending ? "Creating…" : "Create challenge"}
      </button>
    </form>
  );
}

type DurationPickerProps = Pick<Props, "quickDurations" | "units" | "durationRange"> &
  Pick<ChallengeFormState, "values" | "errors">;

// Quick picks plus a "Custom" option that reveals a number and a unit.
function DurationPicker({ quickDurations, units, durationRange, values, errors }: DurationPickerProps) {
  const [duration, setDuration] = useState(values.duration ?? "");
  const custom = duration === "custom";
  const error = errors.duration ?? errors.durationAmount;

  return (
    <fieldset aria-describedby={error ? "duration-error" : undefined}>
      <legend className="font-semibold">How long?</legend>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[...quickDurations.map((d) => ({ value: String(d.minutes), label: d.label })), { value: "custom", label: "Custom" }].map(
          (d) => (
            <label key={d.value} className={`${optionClass} py-3 text-center text-sm font-bold`}>
              <input
                type="radio"
                name="duration"
                value={d.value}
                checked={duration === d.value}
                onChange={() => setDuration(d.value)}
                className="sr-only"
              />
              {d.label}
            </label>
          ),
        )}
      </div>

      {custom && (
        <div className="mt-3">
          <div className="flex gap-2">
            <label htmlFor="durationAmount" className="sr-only">Duration</label>
            <input
              name="durationAmount"
              id="durationAmount"
              defaultValue={values.durationAmount}
              aria-invalid={errors.durationAmount ? true : undefined}
              aria-describedby="duration-range"
              className={`${controlClass} min-w-0 flex-1`}
              inputMode="decimal"
              placeholder="e.g. 3"
              autoFocus
            />
            <label htmlFor="durationUnit" className="sr-only">Unit</label>
            <select
              name="durationUnit"
              id="durationUnit"
              defaultValue={values.durationUnit ?? "hours"}
              className={controlClass}
            >
              {units.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <p id="duration-range" className="mt-1 text-xs text-muted">Anything from {durationRange}.</p>
        </div>
      )}
      {error && <ErrorMessage id="duration-error">{error}</ErrorMessage>}
    </fieldset>
  );
}
