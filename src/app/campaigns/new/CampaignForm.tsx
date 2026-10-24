"use client";

import { useActionState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { createCampaignAction, type FormState } from "./actions";

const initialState: FormState = { errors: {}, values: {} };

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

type Props = { categories: readonly string[] };

export default function CampaignForm({ categories }: Props) {
  const [state, formAction, pending] = useActionState(createCampaignAction, initialState);
  const { errors, values, formError } = state;
  const hasErrors = Object.keys(errors).length > 0;

  const field = (name: keyof FormState["errors"]) => ({
    name,
    id: name,
    defaultValue: values[name],
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    // key resets defaultValues after a failed submit so the user's input is kept
    <form action={formAction} key={JSON.stringify(values)} className="flex flex-col gap-5" noValidate>
      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      {hasErrors && <ErrorMessage>Please fix the highlighted fields below.</ErrorMessage>}

      <div>
        <label htmlFor="title" className="font-semibold">Title</label>
        <input {...field("title")} className={inputClass} placeholder="e.g. Help Wanjiku get heart surgery" maxLength={100} />
        {errors.title && <ErrorMessage id="title-error">{errors.title}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="category" className="font-semibold">Category</label>
        <select {...field("category")} defaultValue={values.category ?? ""} className={inputClass}>
          <option value="" disabled>Choose one</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {errors.category && <ErrorMessage id="category-error">{errors.category}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="goal" className="font-semibold">Goal (KES)</label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 mt-0.5 -translate-y-1/2 text-muted">KES</span>
          <input {...field("goal")} className={`${inputClass} pl-14`} inputMode="numeric" placeholder="100,000" />
        </div>
        {errors.goal && <ErrorMessage id="goal-error">{errors.goal}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="organiser" className="font-semibold">Your name</label>
        <input {...field("organiser")} className={inputClass} autoComplete="name" />
        {errors.organiser && <ErrorMessage id="organiser-error">{errors.organiser}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="beneficiary" className="font-semibold">Who is it for?</label>
        <input {...field("beneficiary")} className={inputClass} placeholder="A person, family or group" />
        {errors.beneficiary && <ErrorMessage id="beneficiary-error">{errors.beneficiary}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="location" className="font-semibold">Location</label>
        <input {...field("location")} className={inputClass} placeholder="Town or county" />
        {errors.location && <ErrorMessage id="location-error">{errors.location}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="story" className="font-semibold">Story</label>
        <p className="text-sm text-muted">Explain what happened and how the money will help.</p>
        <textarea {...field("story")} className={`${inputClass} min-h-40`} rows={6} />
        {errors.story && <ErrorMessage id="story-error">{errors.story}</ErrorMessage>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {pending ? "Creating…" : "Create harambee"}
      </button>
    </form>
  );
}
