"use client";

import { useRef, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import Photo from "@/components/Photo";
import { compressImage, PhotoError } from "@/lib/compressImage";
import { randomId, type PickedPhoto } from "@/lib/uploadPhotos";

type Props = {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  max: number;
  label: string; // e.g. "Add photos" or "Add a cover photo"
  error?: string;
  disabled?: boolean;
};

// Choose photos, see them as thumbnails, remove any. New photos are shrunk
// straight away; they upload when the form is saved.
export default function PhotoPicker({ photos, onChange, max, label, error, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [pickError, setPickError] = useState<string>();

  async function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPickError(undefined);
    const room = max - photos.length;
    const chosen = Array.from(files).slice(0, room);
    setPreparing(true);
    const added: PickedPhoto[] = [];
    let failed: string | undefined;
    for (const file of chosen) {
      try {
        const blob = await compressImage(file);
        added.push({ key: randomId(), blob, preview: URL.createObjectURL(blob) });
      } catch (e) {
        failed = e instanceof PhotoError ? e.message : "We couldn’t prepare that photo. Please try again.";
      }
    }
    setPreparing(false);
    if (files.length > room) failed = `You can add up to ${max} ${max === 1 ? "photo" : "photos"}.`;
    setPickError(failed);
    onChange(max === 1 ? added.slice(0, 1) : [...photos, ...added]);
    if (input.current) input.current.value = ""; // so the same photo can be chosen again
  }

  function remove(key: string) {
    const photo = photos.find((p) => p.key === key);
    if (photo?.blob) URL.revokeObjectURL(photo.preview);
    onChange(photos.filter((p) => p.key !== key));
  }

  const full = photos.length >= max;

  return (
    <div>
      {photos.length > 0 && (
        <ul className={`mt-2 grid gap-2 ${max === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
          {photos.map((p, i) => (
            <li key={p.key} className="relative">
              <Photo
                src={p.preview}
                alt={`Photo ${i + 1}`}
                eager
                className={`w-full rounded-xl ${max === 1 ? "aspect-video" : "aspect-square"}`}
              />
              <button
                type="button"
                onClick={() => remove(p.key)}
                disabled={disabled}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute top-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <label
          className={`mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface px-4 py-3 font-semibold text-accent ring-1 ring-accent/40 ${
            preparing || disabled ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="15" rx="2" />
            <circle cx="12" cy="12.5" r="3.5" />
            <path d="M8 5l1.5-2h5L16 5" />
          </svg>
          {preparing ? "Preparing photos…" : label}
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple={max > 1}
            disabled={preparing || disabled}
            onChange={(e) => add(e.target.files)}
            className="sr-only"
          />
        </label>
      )}
      {max > 1 && (
        <p className="mt-1 text-sm text-muted">
          {photos.length} of {max} photos
        </p>
      )}
      {(pickError || error) && <ErrorMessage>{pickError ?? error}</ErrorMessage>}
    </div>
  );
}
