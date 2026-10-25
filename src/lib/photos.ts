// Campaign photos live in the public "campaign-photos" Storage bucket (see
// supabase/updates.sql) as {campaign id}/cover/{uuid}.jpg and
// {campaign id}/updates/{uuid}.jpg. The database stores those paths.

export const PHOTO_BUCKET = "campaign-photos";
export const MAX_UPDATE_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // the bucket rejects anything bigger

export type PhotoFolder = "cover" | "updates";

export function photoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

export function photoPath(campaignId: string, folder: PhotoFolder, id: string): string {
  return `${campaignId}/${folder}/${id}.jpg`;
}

// Only accept paths we generate, inside this campaign's folder.
export function isPhotoPath(path: unknown, campaignId: string, folder: PhotoFolder): path is string {
  return (
    typeof path === "string" &&
    path.startsWith(`${campaignId}/${folder}/`) &&
    /^[0-9a-f-]{36}\.jpg$/.test(path.slice(campaignId.length + folder.length + 2))
  );
}
