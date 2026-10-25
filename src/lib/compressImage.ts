import { MAX_PHOTO_BYTES } from "@/lib/photos";

// Shrinks a photo in the browser before it's uploaded: longest side 1600px,
// JPEG at 80% quality. A 3–8 MB phone photo usually ends up around 300 KB.
// Redrawing the photo also drops its hidden metadata, including GPS location.

const MAX_EDGE = 1600;

export class PhotoError extends Error {}

export async function compressImage(file: File): Promise<Blob> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new PhotoError("That file isn’t a photo. Choose a JPG or PNG.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file); // also applies the camera's rotation
  } catch {
    throw new PhotoError("We can’t read that photo. Try a JPG or PNG.");
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("We couldn’t prepare that photo. Please try again.");
  ctx.fillStyle = "#FFFFFF"; // transparent PNGs would otherwise turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.8, 0.6]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_PHOTO_BYTES) return blob;
  }
  throw new PhotoError("That photo is too large. Try a smaller one.");
}
