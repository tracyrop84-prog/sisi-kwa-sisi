"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { setCoverAction } from "@/app/campaigns/[slug]/edit/actions";
import ErrorMessage from "@/components/ErrorMessage";
import PhotoPicker from "@/components/PhotoPicker";
import { CATEGORIES, CATEGORY_INFO } from "@/lib/categories";
import { uploadPhotos, type PickedPhoto } from "@/lib/uploadPhotos";
import { createCampaignAction, type FormState } from "./actions";

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

type Props = { organiserName: string };

export default function CampaignForm({ organiserName }: Props) {
  const [state, formAction, pending] = useActionState(createCampaignAction, {
    errors: {},
    values: { organiser: organiserName },
  });
  const { errors, values, formError, created } = state;
  const hasErrors = Object.keys(errors).length > 0;
  const router = useRouter();
  // Kept outside the form below, so a failed submit doesn't lose the photo.
  const [cover, setCover] = useState<PickedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  // The campaign exists now, so its cover photo can go in its folder.
  useEffect(() => {
    if (!created) return;
    setUploading(true);
    (async () => {
      try {
        const [path] = await uploadPhotos(created.id, "cover", cover);
        if ((await setCoverAction(created.slug, path)).error) throw new Error("cover not saved");
        router.push(`/campaigns/${created.slug}`);
      } catch {
        router.push(`/campaigns/${created.slug}/edit?cover=failed`);
      }
    })();
    // Runs once per created campaign; the photo can't change while uploading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created]);
  const busy = pending || uploading;

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
      <input type="hidden" name="hasCover" value={cover.length > 0 ? "1" : ""} />
      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      {hasErrors && <ErrorMessage>Please fix the highlighted fields below.</ErrorMessage>}

      <div>
        <label htmlFor="title" className="font-semibold">Title</label>
        <input {...field("title")} className={inputClass} placeholder="e.g. Help Wanjiku get heart surgery" maxLength={100} />
        {errors.title && <ErrorMessage id="title-error">{errors.title}</ErrorMessage>}
      </div>

      <fieldset aria-describedby={errors.category ? "category-error" : undefined}>
        <legend className="font-semibold">Category</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold ring-1 ring-black/15 has-checked:bg-accent/10 has-checked:ring-2 has-checked:ring-accent has-focus-visible:ring-2 has-focus-visible:ring-accent"
            >
              <input type="radio" name="category" value={c} defaultChecked={values.category === c} className="sr-only" />
              <span aria-hidden="true" className="text-lg leading-none">{CATEGORY_INFO[c].icon}</span>
              {c}
            </label>
          ))}
        </div>
        {errors.category && <ErrorMessage id="category-error">{errors.category}</ErrorMessage>}
      </fieldset>

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

      <div>
        <p className="font-semibold">
          Cover photo <span className="font-normal text-muted">(optional)</span>
        </p>
        <p className="text-sm text-muted">Shown at the top of the page and when the link is shared.</p>
        <PhotoPicker photos={cover} onChange={setCover} max={1} label="Add a cover photo" disabled={busy} />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {uploading ? "Uploading photo…" : pending ? "Creating…" : "Create harambee"}
      </button>
    </form>
  );
}
