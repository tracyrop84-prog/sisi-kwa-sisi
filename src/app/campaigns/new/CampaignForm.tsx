"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { setCoverAction } from "@/app/campaigns/[slug]/edit/actions";
import ErrorMessage from "@/components/ErrorMessage";
import PhotoPicker from "@/components/PhotoPicker";
import { APPROVAL_GOAL, CAMPAIGN_DECLARATION, MINOR_PHOTO_CONSENT } from "@/lib/campaignRules";
import { CATEGORIES, CATEGORY_INFO } from "@/lib/categories";
import { MAX_VIDEO_URL } from "@/lib/videoLinks";
import { uploadPhotos, type PickedPhoto } from "@/lib/uploadPhotos";
import { createCampaignAction, type FormState } from "./actions";

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

type Props = {
  organiserName: string;
  maxGoal: number | null; // null when the organiser isn't capped (see NEW_ORGANISER_MAX_GOAL)
};

export default function CampaignForm({ organiserName, maxGoal }: Props) {
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
  // Which optional sections show. Kept here, so they survive a failed submit.
  const [viral, setViral] = useState(values.viral === "on");
  const [askToConfirm, setAskToConfirm] = useState(values.confirmBeneficiary === "on");
  const [minorTicked, setMinorTicked] = useState(values.minor === "on");
  // Viral harambees always need confirmation; others can ask for it. Under 18
  // is offered once there's a confirmation, since the guardian gives it.
  const confirming = viral || askToConfirm;
  const minor = confirming && minorTicked;

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

      <div className="rounded-xl bg-surface p-4 ring-1 ring-black/15">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="viral"
            checked={viral}
            onChange={(e) => setViral(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-accent"
          />
          <span>
            <span className="block font-semibold">This person went viral</span>
            <span className="block text-sm text-muted">
              Link the original video. We’ll ask them to confirm by SMS before the harambee goes live.
            </span>
          </span>
        </label>
        {viral && (
          <div className="mt-4">
            <label htmlFor="videoUrl" className="font-semibold">Link to the original video</label>
            <p className="text-sm text-muted">TikTok, Facebook, Instagram or YouTube.</p>
            <input
              {...field("videoUrl")}
              className={inputClass}
              type="url"
              inputMode="url"
              placeholder="https://www.tiktok.com/@…"
              maxLength={MAX_VIDEO_URL}
            />
            {errors.videoUrl && <ErrorMessage id="videoUrl-error">{errors.videoUrl}</ErrorMessage>}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="goal" className="font-semibold">Goal (KES)</label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 mt-0.5 -translate-y-1/2 text-muted">KES</span>
          <input {...field("goal")} className={`${inputClass} pl-14`} inputMode="numeric" placeholder="e.g. 50,000" />
        </div>
        <p className="mt-1 text-sm text-muted">
          {maxGoal
            ? `Up to KES ${maxGoal.toLocaleString("en-KE")} for your first harambee. Once one is completed or its documents are checked, you can ask for more.`
            : `Goals over KES ${APPROVAL_GOAL.toLocaleString("en-KE")} are checked by our team before they go live.`}
        </p>
        {errors.goal && <ErrorMessage id="goal-error">{errors.goal}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="organiser" className="font-semibold">Your name</label>
        <input {...field("organiser")} className={inputClass} autoComplete="name" />
        {errors.organiser && <ErrorMessage id="organiser-error">{errors.organiser}</ErrorMessage>}
      </div>

      <div className="rounded-xl bg-surface p-4 ring-1 ring-black/15">
        <label htmlFor="beneficiary" className="font-semibold">Who is it for?</label>
        <input {...field("beneficiary")} className={inputClass} placeholder="A person, family or group" />
        {errors.beneficiary && <ErrorMessage id="beneficiary-error">{errors.beneficiary}</ErrorMessage>}

        <div className="mt-4 border-t border-black/5 pt-4">
          {viral ? (
            <>
              <p className="font-semibold">We’ll ask them to confirm</p>
              <p className="text-sm text-muted">
                Viral harambees are confirmed by SMS before they go live. Once confirmed, it shows a Verified badge.
              </p>
            </>
          ) : (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="confirmBeneficiary"
                checked={askToConfirm}
                onChange={(e) => setAskToConfirm(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-accent"
              />
              <span>
                <span className="block font-semibold">
                  Ask them to confirm <span className="font-normal text-muted">(optional)</span>
                </span>
                <span className="block text-sm text-muted">
                  If you’re raising for someone else, we’ll text them a code. Once they confirm, your harambee shows a
                  Verified badge. It goes live after they confirm.
                </span>
              </span>
            </label>
          )}

          {confirming && (
            <>
              <label className="mt-4 flex items-start gap-3">
                <input
                  type="checkbox"
                  name="minor"
                  checked={minorTicked}
                  onChange={(e) => setMinorTicked(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-accent"
                />
                <span>
                  <span className="block font-semibold">The beneficiary is under 18</span>
                  <span className="block text-sm text-muted">
                    Their parent or guardian confirms instead, and our team checks it before it goes live. It can be
                    you if you’re the parent or guardian.
                  </span>
                </span>
              </label>
              {minor && (
                <div role="note" className="mt-3 flex items-start gap-3 rounded-xl bg-accent/10 p-3">
                  <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true">
                    <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M10 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="10" cy="6.2" r="1" fill="currentColor" />
                  </svg>
                  <p className="text-sm">
                    <span className="font-semibold">Keep the child safe.</span> Don’t include the name of their school
                    or where they live (estate, village or home) in the title, story, location or photos. A town or
                    county is enough.
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <label htmlFor="beneficiaryName" className="font-semibold">
                    {minor ? "Parent or guardian’s full name" : "Their full name"}
                  </label>
                  <input {...field("beneficiaryName")} className={inputClass} placeholder="e.g. Grace Akinyi" maxLength={100} />
                  {errors.beneficiaryName && (
                    <ErrorMessage id="beneficiaryName-error">{errors.beneficiaryName}</ErrorMessage>
                  )}
                </div>
                {minor && (
                  <div>
                    <label htmlFor="beneficiaryRelationship" className="font-semibold">Relationship to the child</label>
                    <input
                      {...field("beneficiaryRelationship")}
                      className={inputClass}
                      placeholder="e.g. Mother, Grandfather, Aunt"
                      maxLength={50}
                    />
                    {errors.beneficiaryRelationship && (
                      <ErrorMessage id="beneficiaryRelationship-error">{errors.beneficiaryRelationship}</ErrorMessage>
                    )}
                  </div>
                )}
                <div>
                  <label htmlFor="beneficiaryPhone" className="font-semibold">
                    {minor ? "Parent or guardian’s phone number" : "Their phone number"}
                  </label>
                  <p className="text-sm text-muted">
                    Only our team can see it. Money raised will only ever be paid to this number.
                  </p>
                  <input
                    {...field("beneficiaryPhone")}
                    className={inputClass}
                    type="tel"
                    inputMode="tel"
                    placeholder="0712 345 678"
                  />
                  {errors.beneficiaryPhone && (
                    <ErrorMessage id="beneficiaryPhone-error">{errors.beneficiaryPhone}</ErrorMessage>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
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

      {minor && (
        <div>
          <label className="flex items-start gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-black/15">
            <input
              type="checkbox"
              name="minorConsent"
              defaultChecked={values.minorConsent === "on"}
              aria-invalid={errors.minorConsent ? true : undefined}
              aria-describedby={errors.minorConsent ? "minorConsent-error" : undefined}
              className="mt-1 h-4 w-4 shrink-0 accent-accent"
            />
            <span className="text-sm">{MINOR_PHOTO_CONSENT}</span>
          </label>
          {errors.minorConsent && <ErrorMessage id="minorConsent-error">{errors.minorConsent}</ErrorMessage>}
        </div>
      )}

      <div>
        <label className="flex items-start gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-black/15">
          <input
            type="checkbox"
            name="declaration"
            defaultChecked={values.declaration === "on"}
            aria-invalid={errors.declaration ? true : undefined}
            aria-describedby={errors.declaration ? "declaration-error" : undefined}
            className="mt-1 h-4 w-4 shrink-0 accent-accent"
          />
          <span className="text-sm">{CAMPAIGN_DECLARATION}</span>
        </label>
        {errors.declaration && <ErrorMessage id="declaration-error">{errors.declaration}</ErrorMessage>}
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
