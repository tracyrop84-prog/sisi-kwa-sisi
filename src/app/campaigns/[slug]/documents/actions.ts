"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import { isDocumentType, MAX_DOCUMENT_BYTES, MAX_DOCUMENTS } from "@/lib/documentRules";
import { addDocument, removeDocument } from "@/lib/documents";

// The browser uploads the file itself (server actions only accept about 1 MB):
// first it asks for a place here, then uploads, then removes the place again
// if the upload failed.

const NOT_ALLOWED = "Documents can’t be changed on this harambee any more. Refresh the page.";

export async function addDocumentAction(
  slug: string,
  file: { fileName: string; contentType: string; sizeBytes: number },
): Promise<{ id: string; path: string } | { error: string }> {
  const [user, campaign] = await Promise.all([getCurrentUser(), getCampaign(slug)]);
  if (!user || !campaign || campaign.organiserId !== user.id) {
    return { error: "Only the organiser can add documents. Please log in again." };
  }
  if (!isDocumentType(file?.contentType)) return { error: "Choose a photo (JPG, PNG or WebP) or a PDF." };
  if (!Number.isInteger(file.sizeBytes) || file.sizeBytes < 1 || file.sizeBytes > MAX_DOCUMENT_BYTES) {
    return { error: "Each file can be up to 5 MB." };
  }
  const fileName = String(file.fileName ?? "").trim().slice(0, 200) || "Document";

  const result = await addDocument(campaign.id, { fileName, contentType: file.contentType, sizeBytes: file.sizeBytes });
  if ("error" in result) {
    return { error: result.error === "document_limit" ? `You can add up to ${MAX_DOCUMENTS} documents.` : NOT_ALLOWED };
  }
  return result;
}

export async function removeDocumentAction(slug: string, id: string): Promise<{ error?: string }> {
  if (typeof id !== "string") return { error: NOT_ALLOWED };
  const result = await removeDocument(id);
  revalidatePath(`/campaigns/${slug}/documents`);
  return "error" in result ? { error: NOT_ALLOWED } : {};
}
