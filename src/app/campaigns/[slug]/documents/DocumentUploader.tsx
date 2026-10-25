"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import { DOCUMENT_BUCKET, DOCUMENT_TYPES, isDocumentType, MAX_DOCUMENT_BYTES } from "@/lib/documentRules";
import { createClient } from "@/lib/supabase/client";
import { addDocumentAction, removeDocumentAction } from "./actions";

type Props = { campaignSlug: string; slotsLeft: number };

// Uploads straight from the browser to the private bucket, one file at a time.
export default function DocumentUploader({ campaignSlug, slotsLeft }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // so picking the same file again still triggers a change
    if (files.length === 0) return;
    setError(null);

    if (files.length > slotsLeft) {
      setError(slotsLeft === 1 ? "You can add 1 more document." : `You can add ${slotsLeft} more documents.`);
      return;
    }
    const bad = files.find((f) => !isDocumentType(f.type));
    if (bad) return setError(`${bad.name} isn’t a photo (JPG, PNG or WebP) or a PDF.`);
    const big = files.find((f) => f.size > MAX_DOCUMENT_BYTES);
    if (big) return setError(`${big.name} is over 5 MB. Try a smaller photo or a shorter PDF.`);

    const supabase = createClient();
    try {
      for (const file of files) {
        setUploading(file.name);
        const place = await addDocumentAction(campaignSlug, {
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });
        if ("error" in place) throw new Error(place.error);
        const { error: uploadError } = await supabase.storage
          .from(DOCUMENT_BUCKET)
          .upload(place.path, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          await removeDocumentAction(campaignSlug, place.id);
          throw new Error(`${file.name} didn’t upload. Check your connection and try again.`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setUploading(null);
      router.refresh();
    }
  }

  return (
    <div className="mt-4">
      <input
        ref={input}
        type="file"
        accept={DOCUMENT_TYPES.join(",")}
        multiple
        onChange={upload}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={!!uploading}
        className="w-full rounded-xl bg-surface px-4 py-3 font-bold text-accent ring-1 ring-accent/40 active:scale-[0.99] disabled:opacity-70"
      >
        {uploading ? `Uploading ${uploading}…` : "Add documents"}
      </button>
      <p className="mt-1 text-center text-xs text-muted">Photos or PDFs, up to 5 MB each</p>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}
