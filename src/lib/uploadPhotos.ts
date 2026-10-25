import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET, photoPath, type PhotoFolder } from "@/lib/photos";

// A photo in a picker: either already stored (path) or new and waiting to upload (blob).
export type PickedPhoto = { key: string; preview: string; path?: string; blob?: Blob };

// crypto.randomUUID only exists on https and localhost; this also works when
// testing on a phone over the local network (http://192.168…).
export function randomId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Uploads the new photos straight from the browser to Supabase Storage (server
// actions only accept about 1 MB), then returns every photo's path in order.
// If one upload fails, the ones already uploaded are removed again.
export async function uploadPhotos(campaignId: string, folder: PhotoFolder, photos: PickedPhoto[]): Promise<string[]> {
  const supabase = createClient();
  const uploaded: string[] = [];
  try {
    const paths: string[] = [];
    for (const photo of photos) {
      if (photo.path) {
        paths.push(photo.path);
        continue;
      }
      const path = photoPath(campaignId, folder, randomId());
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, photo.blob!, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (error) throw error;
      uploaded.push(path);
      paths.push(path);
    }
    return paths;
  } catch (error) {
    if (uploaded.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
    throw error;
  }
}
