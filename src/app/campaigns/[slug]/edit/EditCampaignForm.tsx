"use client";

import { useState, useTransition } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import PhotoPicker from "@/components/PhotoPicker";
import { campaignDetailErrors, goalError, type DetailField } from "@/lib/campaignRules";
import { photoUrl } from "@/lib/photos";
import { uploadPhotos, type PickedPhoto } from "@/lib/uploadPhotos";
import { editCampaignAction, type EditCampaignState } from "./actions";

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

type Props = {
  campaignId: string;
  campaignSlug: string;
  initial: Record<DetailField, string>;
  beneficiaryLocked: boolean; // true once the campaign has a donation or the beneficiary confirmed
  coverPhoto: string | null;
  // Only while an admin has requested changes. maxGoal is set for organisers
  // who are still capped at NEW_ORGANISER_MAX_GOAL.
  goal?: { initial: number; maxGoal: number | null };
};

export default function EditCampaignForm({ campaignId, campaignSlug, initial, beneficiaryLocked, coverPhoto, goal }: Props) {
  const [values, setValues] = useState(initial);
  const [goalText, setGoalText] = useState(goal ? goal.initial.toLocaleString("en-KE") : "");
  const [cover, setCover] = useState<PickedPhoto[]>(
    coverPhoto ? [{ key: coverPhoto, path: coverPhoto, preview: photoUrl(coverPhoto) }] : [],
  );
  const [state, setState] = useState<EditCampaignState>({ errors: {} });
  const [saving, startSaving] = useTransition();
  const { errors, formError } = state;
  const hasErrors = Object.keys(errors).length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = {
      title: values.title.trim(),
      beneficiary: values.beneficiary.trim(),
      location: values.location.trim(),
      story: values.story.trim(),
    };
    // Check the text before uploading, so a photo isn't uploaded for nothing.
    const found: EditCampaignState["errors"] = campaignDetailErrors(trimmed);
    if (goal) {
      const typed = Number(goalText.replace(/[,\s]/g, ""));
      const problem = typed === goal.initial ? undefined : goalError(typed, goal.maxGoal);
      if (problem) found.goal = problem;
    }
    if (Object.keys(found).length > 0) {
      setState({ errors: found });
      return;
    }
    startSaving(async () => {
      let paths: string[];
      try {
        paths = await uploadPhotos(campaignId, "cover", cover);
      } catch {
        setState({ errors: {}, formError: "We couldn’t upload the photo. Check your connection and try again." });
        return;
      }
      // On success the server sends the browser to the campaign page.
      setState(await editCampaignAction(campaignSlug, trimmed, paths[0] ?? null, goal ? goalText : null));
    });
  }

  const field = (name: DetailField) => ({
    id: name,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      {hasErrors && <ErrorMessage>Please fix the highlighted fields below.</ErrorMessage>}

      <div>
        <p className="font-semibold">
          Cover photo <span className="font-normal text-muted">(optional)</span>
        </p>
        <p className="text-sm text-muted">Shown at the top of the page and when the link is shared.</p>
        <PhotoPicker photos={cover} onChange={setCover} max={1} label="Add a cover photo" disabled={saving} />
      </div>

      <div>
        <label htmlFor="title" className="font-semibold">Title</label>
        <input {...field("title")} className={inputClass} maxLength={100} />
        {errors.title && <ErrorMessage id="title-error">{errors.title}</ErrorMessage>}
      </div>

      {goal && (
        <div>
          <label htmlFor="goal" className="font-semibold">Goal (KES)</label>
          <p className="text-sm text-muted">
            {goal.maxGoal
              ? `You can change it while our team is asking for changes, up to KES ${goal.maxGoal.toLocaleString("en-KE")}.`
              : "You can change it while our team is asking for changes."}
          </p>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 mt-0.5 -translate-y-1/2 text-muted">KES</span>
            <input
              id="goal"
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              inputMode="numeric"
              aria-invalid={errors.goal ? true : undefined}
              aria-describedby={errors.goal ? "goal-error" : undefined}
              className={`${inputClass} pl-14`}
            />
          </div>
          {errors.goal && <ErrorMessage id="goal-error">{errors.goal}</ErrorMessage>}
        </div>
      )}

      <div>
        <label htmlFor="beneficiary" className="font-semibold">Who is it for?</label>
        {beneficiaryLocked && (
          <p className="text-sm text-muted">This can’t be changed once the harambee has a donation or has been confirmed.</p>
        )}
        <input
          {...field("beneficiary")}
          className={`${inputClass} disabled:bg-black/5 disabled:text-muted`}
          disabled={beneficiaryLocked}
          placeholder="A person, family or group"
        />
        {errors.beneficiary && <ErrorMessage id="beneficiary-error">{errors.beneficiary}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="location" className="font-semibold">Location</label>
        <input {...field("location")} className={inputClass} placeholder="Town or county" />
        {errors.location && <ErrorMessage id="location-error">{errors.location}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="story" className="font-semibold">Story</label>
        <textarea {...field("story")} className={`${inputClass} min-h-40`} rows={8} />
        {errors.story && <ErrorMessage id="story-error">{errors.story}</ErrorMessage>}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {saving ? (cover.some((p) => p.blob) ? "Uploading photo…" : "Saving…") : "Save changes"}
      </button>
    </form>
  );
}
