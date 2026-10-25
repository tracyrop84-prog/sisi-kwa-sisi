"use client";

import { useState, useTransition } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import type { Category } from "@/lib/categories";
import PhotoPicker from "@/components/PhotoPicker";
import { MAX_UPDATE_PHOTOS, photoUrl } from "@/lib/photos";
import {
  MAX_BODY,
  MAX_GIFT_GIVER,
  MAX_GIFT_ITEM,
  RECOVERY_STATUSES,
  UPDATE_TYPES,
  updateEmoji,
  updateErrors,
  updateLabel,
  updateTypesFor,
  type UpdateErrors,
  type UpdateType,
  type UpdateValues,
} from "@/lib/updateTypes";
import { uploadPhotos, type PickedPhoto } from "@/lib/uploadPhotos";
import { createUpdateAction, editUpdateAction, type UpdateFormState } from "./actions";

const inputClass =
  "mt-1 block w-full rounded-xl border border-black/15 bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:bg-black/5 disabled:text-muted";

type Props = {
  campaignId: string;
  campaignSlug: string;
  category: Category; // decides which update types are offered
  // Editing an existing update:
  updateId?: string;
  initial?: UpdateValues;
  initialPhotos?: string[];
};

const blank: UpdateValues = {
  type: "",
  body: "",
  giftItem: "",
  giftGiver: "",
  giftAnonymous: false,
  giftValue: "",
  recoveryStatus: "",
  consent: false,
};

export default function UpdateForm({ campaignId, campaignSlug, category, updateId, initial, initialPhotos = [] }: Props) {
  const editing = updateId !== undefined;
  const [values, setValues] = useState<UpdateValues>(initial ?? blank);
  const [photos, setPhotos] = useState<PickedPhoto[]>(
    initialPhotos.map((path) => ({ key: path, path, preview: photoUrl(path) })),
  );
  const [state, setState] = useState<UpdateFormState>({ errors: {} });
  const [saving, startSaving] = useTransition();
  const { errors, formError } = state;
  const type = values.type as UpdateType | "";

  const set = <K extends keyof UpdateValues>(key: K, value: UpdateValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Check everything before uploading, so photos aren't uploaded for nothing.
    const found = updateErrors(values, photos.length, editing ? undefined : category);
    if (Object.keys(found).length > 0) {
      setState({ errors: found });
      return;
    }
    startSaving(async () => {
      let paths: string[];
      try {
        paths = await uploadPhotos(campaignId, "updates", photos);
      } catch {
        setState({ errors: {}, formError: "We couldn’t upload the photos. Check your connection and try again." });
        return;
      }
      // On success the server sends the browser to the campaign page.
      const result = editing
        ? await editUpdateAction(campaignSlug, updateId, values, paths)
        : await createUpdateAction(campaignSlug, values, paths);
      setState(result);
    });
  }

  const field = (name: keyof UpdateErrors) => ({
    id: name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  const fieldError = (name: keyof UpdateErrors) =>
    errors[name] && <ErrorMessage id={`${name}-error`}>{errors[name]}</ErrorMessage>;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {formError && <ErrorMessage>{formError}</ErrorMessage>}
      {hasErrors && <ErrorMessage>Please fix the highlighted fields below.</ErrorMessage>}

      {editing ? (
        <p className="font-semibold">
          {updateEmoji(type as UpdateType, category)} {updateLabel(type as UpdateType, category)}
        </p>
      ) : (
        <fieldset>
          <legend className="font-semibold">What kind of update?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {updateTypesFor(category).map((t) => {
              const selected = type === t;
              return (
                <label
                  key={t}
                  className={`flex cursor-pointer flex-col rounded-xl p-3 ring-1 ${
                    selected ? "bg-accent/10 ring-2 ring-accent" : "bg-surface ring-black/15"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={selected}
                    onChange={() => set("type", t)}
                    className="sr-only"
                  />
                  <span className="font-bold">
                    <span aria-hidden="true">{updateEmoji(t, category)}</span> {updateLabel(t, category)}
                  </span>
                  <span className="mt-1 text-xs text-muted">{UPDATE_TYPES[t].hint}</span>
                </label>
              );
            })}
          </div>
          {fieldError("type")}
        </fieldset>
      )}

      {type === "gift" && (
        <>
          <div>
            <label htmlFor="giftItem" className="font-semibold">What was given?</label>
            <input
              {...field("giftItem")}
              value={values.giftItem}
              onChange={(e) => set("giftItem", e.target.value)}
              className={inputClass}
              placeholder="e.g. a bed, kitchen utensils"
              maxLength={MAX_GIFT_ITEM}
            />
            {fieldError("giftItem")}
          </div>

          <div>
            <label htmlFor="giftGiver" className="font-semibold">Who gave it?</label>
            <input
              {...field("giftGiver")}
              value={values.giftAnonymous ? "" : values.giftGiver}
              onChange={(e) => set("giftGiver", e.target.value)}
              disabled={values.giftAnonymous}
              className={inputClass}
              placeholder="e.g. Kamau"
              maxLength={MAX_GIFT_GIVER}
            />
            {fieldError("giftGiver")}
            <label className="mt-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={values.giftAnonymous}
                onChange={(e) => set("giftAnonymous", e.target.checked)}
                className="h-5 w-5 accent-accent"
              />
              <span>Anonymous</span>
            </label>
          </div>

          <div>
            <label htmlFor="giftValue" className="font-semibold">
              Estimated value <span className="font-normal text-muted">(optional)</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 mt-0.5 -translate-y-1/2 text-muted">KES</span>
              <input
                {...field("giftValue")}
                value={values.giftValue}
                onChange={(e) => set("giftValue", e.target.value)}
                className={`${inputClass} pl-14`}
                inputMode="numeric"
                placeholder="15,000"
              />
            </div>
            <p className="mt-1 text-sm text-muted">Gifts are listed separately. They don’t count toward the cash raised.</p>
            {fieldError("giftValue")}
          </div>
        </>
      )}

      {type === "recovery" && (
        <div>
          <label htmlFor="recoveryStatus" className="font-semibold">
            Status <span className="font-normal text-muted">(optional)</span>
          </label>
          <select
            {...field("recoveryStatus")}
            value={values.recoveryStatus}
            onChange={(e) => set("recoveryStatus", e.target.value)}
            className={inputClass}
          >
            <option value="">No status</option>
            {Object.entries(RECOVERY_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {fieldError("recoveryStatus")}
        </div>
      )}

      {type && (
        <>
          <div>
            <label htmlFor="body" className="font-semibold">
              {type === "gift" ? (
                <>Note <span className="font-normal text-muted">(optional)</span></>
              ) : (
                "Update"
              )}
            </label>
            <textarea
              {...field("body")}
              value={values.body}
              onChange={(e) => set("body", e.target.value)}
              className={`${inputClass} min-h-32`}
              rows={5}
              maxLength={MAX_BODY}
              placeholder={
                type === "gift"
                  ? "e.g. Asante sana! Mama Wanjiku can now sleep comfortably."
                  : type === "recovery"
                    ? "How is the patient doing?"
                    : type === "progress"
                      ? "What has been done so far?"
                      : "Share news or say thank you"
              }
            />
            {fieldError("body")}
          </div>

          <div>
            <p className="font-semibold">
              Photos <span className="font-normal text-muted">(optional)</span>
            </p>
            {type === "recovery" && (
              <p className="mt-1 rounded-xl bg-accent/10 px-3 py-2 text-sm">
                Photos are optional. Only add photos of the patient with their consent.
              </p>
            )}
            {type === "progress" && (
              <p className="mt-1 text-sm text-muted">Before-and-after photos work well.</p>
            )}
            <PhotoPicker
              photos={photos}
              onChange={setPhotos}
              max={MAX_UPDATE_PHOTOS}
              label="Add photos"
              error={errors.photos}
              disabled={saving}
            />
          </div>

          {type === "recovery" && photos.length > 0 && (
            <div>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={values.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                  aria-invalid={errors.consent ? true : undefined}
                  aria-describedby={errors.consent ? "consent-error" : undefined}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
                />
                <span>I have the patient’s consent to share these photos</span>
              </label>
              {fieldError("consent")}
            </div>
          )}
        </>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-70"
      >
        {saving ? (photos.some((p) => p.blob) ? "Uploading photos…" : "Saving…") : editing ? "Save changes" : "Post update"}
      </button>
    </form>
  );
}
