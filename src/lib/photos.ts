import type { Photo } from "./types";
import { uid } from "./db";
export const MAX_PHOTOS = 8;
export async function compressPhoto(file: File, angle: string): Promise<Photo> {
  if (!file.type.startsWith("image/"))
    throw new Error(
      "Choisissez une image JPEG, PNG, WebP ou une photo compatible avec votre appareil.",
    );
  if (file.size > 30 * 1024 * 1024)
    throw new Error(
      "Cette image dépasse 30 Mo. Choisissez une version plus légère.",
    );
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "Format photo non lisible. Exportez la photo en JPEG ou PNG (notamment pour HEIC).",
    );
  }
  const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Le traitement d’image est indisponible.");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compression impossible."))),
      "image/jpeg",
      0.82,
    ),
  );
  return { id: uid(), blob, angle, createdAt: Date.now() };
}
export const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Lecture de la photo impossible."));
    reader.readAsDataURL(blob);
  });
