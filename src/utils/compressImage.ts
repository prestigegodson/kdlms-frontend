/** The longest edge a compressed photo keeps - plenty to read a bank slip or transfer screenshot. */
export const MAX_IMAGE_EDGE = 2000;

/** Below the backend's 2 MB image cap (PaymentAttachmentPolicy) with headroom for multipart overhead. */
export const TARGET_IMAGE_BYTES = 1.8 * 1024 * 1024;

const QUALITY_STEPS = [0.82, 0.74, 0.66, 0.6];

/** A photo the browser couldn't turn into a small-enough JPEG - `message` is safe to show the user. */
export class CompressImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompressImageError";
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function jpegName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, "") || "photo";
  return `${stem}.jpg`;
}

/**
 * Re-encodes a phone photo as a JPEG small enough for the fee-payment proof upload (Phase 45H,
 * D14): honours the EXIF orientation, scales the long edge down to {@link MAX_IMAGE_EDGE}, then
 * steps the JPEG quality down until it's under {@link TARGET_IMAGE_BYTES}. Every photo is
 * re-encoded, even one already small enough - that's also what strips its EXIF metadata (GPS
 * location included) before it leaves the device.
 *
 * Throws {@link CompressImageError} when the browser can't decode the format at all (e.g. HEIC on
 * desktop Chrome) or the photo is still too big at the lowest quality step.
 */
export async function compressImage(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new CompressImageError(
      `"${file.name}" couldn't be opened. Try a JPEG or PNG photo, or a screenshot of the receipt.`,
    );
  }

  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new CompressImageError(`"${file.name}" couldn't be prepared for upload. Please try again.`);
    }
    // A transparent PNG would otherwise turn black once flattened to JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob && blob.size < TARGET_IMAGE_BYTES) {
        return new File([blob], jpegName(file.name), { type: "image/jpeg", lastModified: Date.now() });
      }
    }
    throw new CompressImageError(`"${file.name}" is too large even after compressing. Try a smaller photo.`);
  } finally {
    bitmap.close?.();
  }
}
