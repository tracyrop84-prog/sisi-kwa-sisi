import type { Category } from "@/lib/categories";

// Supporting documents live in the private "campaign-documents" Storage bucket
// (see supabase/organiser_verification.sql). Only the organiser and admins can
// read them; they are never public. Shared by the browser and the server.

export const DOCUMENT_BUCKET = "campaign-documents";
export const MAX_DOCUMENTS = 5;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // the bucket rejects anything bigger

// Keep in sync with the content_type check in supabase/organiser_verification.sql.
export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function isDocumentType(x: unknown): x is DocumentType {
  return typeof x === "string" && (DOCUMENT_TYPES as readonly string[]).includes(x);
}

// What fits each category, shown above the upload button.
export const DOCUMENT_SUGGESTIONS: Record<Category, string[]> = {
  Medical: ["Hospital bill or quotation", "Doctor’s letter or medical report"],
  Education: ["Building plans", "Contractor’s quotation", "Letter from the school"],
  "School Fees": ["Fee structure", "Admission letter"],
  Funeral: ["Burial permit", "Death certificate or letter from the chief"],
  Wedding: ["Wedding budget", "Letter from the church or a local leader"],
  Emergency: ["Police abstract or fire report", "Letter from the chief"],
  Community: ["Building plans or project budget", "Letter from the chief or committee"],
  "Church & Faith": ["Building plans", "Letter from the church leadership"],
  "Business & Empowerment": ["Business plan", "Supplier quotations"],
  Farming: ["Supplier quotations", "Letter from the chief or farmers’ group"],
  Housing: ["Building plans", "Contractor’s quotation"],
  "Sports & Youth": ["Tournament invitation or budget", "Letter from the club or school"],
  Talent: ["Invitation to perform or compete", "Quotation for equipment, studio time or training"],
  "Elder Care": ["Medical report", "Care home or hospital invoice"],
  Other: ["Any document that shows what the money is for"],
};
