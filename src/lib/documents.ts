import "server-only";
import { DOCUMENT_BUCKET, type DocumentType } from "@/lib/documentRules";
import { createClient } from "@/lib/supabase/server";

// Supporting documents live in the "campaign_documents" table and the private
// "campaign-documents" bucket (see supabase/organiser_verification.sql).
// Row-level security only shows them to the campaign's organiser and admins.

export type CampaignDocument = {
  id: string;
  campaignId: string;
  fileName: string;
  contentType: DocumentType;
  sizeBytes: number;
  path: string;
  createdAt: string;
  // A short-lived link to view it, or null if the upload never finished.
  url: string | null;
};

const LINK_SECONDS = 5 * 60;

// Oldest first, each with a link that works for 5 minutes.
export async function getDocuments(campaignIds: string[]): Promise<CampaignDocument[]> {
  if (campaignIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_documents")
    .select("id, campaign_id, file_name, content_type, size_bytes, path, created_at")
    .in("campaign_id", campaignIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (data.length === 0) return [];

  // Missing files (an upload that never finished) come back with an error, not a link.
  const { data: links, error: linkError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrls(data.map((d) => d.path as string), LINK_SECONDS);
  if (linkError) throw linkError;
  const urls = new Map(links.map((l) => [l.path, l.error ? null : l.signedUrl]));

  return data.map((d) => ({
    id: d.id,
    campaignId: d.campaign_id,
    fileName: d.file_name,
    contentType: d.content_type,
    sizeBytes: d.size_bytes,
    path: d.path,
    createdAt: d.created_at,
    url: urls.get(d.path) ?? null,
  }));
}

// For admins: campaigns with documents that haven't been checked yet.
export async function getCampaignIdsWithDocuments(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("campaign_documents").select("campaign_id");
  if (error) throw error;
  return [...new Set(data.map((d) => d.campaign_id as string))];
}

export type DocumentError = "document_limit" | "not_allowed";

// Adds the row; the browser then uploads the file to the returned path. The
// database refuses a 6th document, or any once they've been checked.
export async function addDocument(
  campaignId: string,
  file: { fileName: string; contentType: DocumentType; sizeBytes: number },
): Promise<{ id: string; path: string } | { error: DocumentError }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_documents")
    .insert({
      campaign_id: campaignId,
      file_name: file.fileName,
      content_type: file.contentType,
      size_bytes: file.sizeBytes,
    })
    .select("id, path")
    .single();
  if (!error) return { id: data.id, path: data.path };
  if (error.code === "P0001" && error.message === "document_limit") return { error: "document_limit" };
  if (error.code === "42501") return { error: "not_allowed" }; // row-level security
  throw error;
}

// Removes the file first (Storage only allows it while the row exists), then the row.
export async function removeDocument(id: string): Promise<{ ok: true } | { error: DocumentError }> {
  const supabase = await createClient();
  const { data: doc, error } = await supabase.from("campaign_documents").select("path").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!doc) return { error: "not_allowed" };

  const { error: storageError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([doc.path]);
  if (storageError) console.error("Couldn't remove document file:", storageError.message);
  const { data: deleted, error: deleteError } = await supabase
    .from("campaign_documents")
    .delete()
    .eq("id", id)
    .select("id");
  if (deleteError) throw deleteError;
  return deleted.length > 0 ? { ok: true } : { error: "not_allowed" };
}
