import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompressImageError, MAX_IMAGE_EDGE, TARGET_IMAGE_BYTES, compressImage } from "@/utils/compressImage";

const MB = 1024 * 1024;

/** Sizes `toBlob` returns per call, in order - the last one repeats. */
let blobSizes: number[];
let qualities: number[];
let drawn: { width: number; height: number } | null;

function stubBitmap(width: number, height: number) {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(() => Promise.resolve({ width, height, close: vi.fn() })),
  );
}

beforeEach(() => {
  blobSizes = [500 * 1024];
  qualities = [];
  drawn = null;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        fillRect: vi.fn(),
        fillStyle: "",
        drawImage: vi.fn((_image: unknown, _x: number, _y: number, width: number, height: number) => {
          drawn = { width, height };
        }),
      }) as unknown as CanvasRenderingContext2D as never,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, _type, quality) => {
    qualities.push(quality as number);
    const size = blobSizes.length > 1 ? blobSizes.shift()! : blobSizes[0];
    callback(new Blob([new Uint8Array(size)], { type: "image/jpeg" }));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("compressImage", () => {
  it("re-encodes a small photo as a .jpg JPEG at the first quality step", async () => {
    stubBitmap(800, 600);
    const result = await compressImage(new File(["x"], "slip.png", { type: "image/png" }));

    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("slip.jpg");
    expect(qualities).toEqual([0.82]);
    expect(drawn).toEqual({ width: 800, height: 600 });
  });

  it("scales the long edge down to the cap, keeping the aspect ratio", async () => {
    stubBitmap(3000, 4000);
    await compressImage(new File(["x"], "IMG_0001.jpeg", { type: "image/jpeg" }));

    expect(drawn).toEqual({ width: 1500, height: MAX_IMAGE_EDGE });
  });

  it("steps the quality down until the photo fits", async () => {
    stubBitmap(2000, 1500);
    blobSizes = [3 * MB, 2 * MB, 1 * MB];
    const result = await compressImage(new File(["x"], "photo.jpg", { type: "image/jpeg" }));

    expect(qualities).toEqual([0.82, 0.74, 0.66]);
    expect(result.size).toBeLessThan(TARGET_IMAGE_BYTES);
  });

  it("gives up with a friendly error when it's still too big at the lowest quality", async () => {
    stubBitmap(2000, 1500);
    blobSizes = [5 * MB];

    await expect(compressImage(new File(["x"], "huge.jpg", { type: "image/jpeg" }))).rejects.toThrow(
      /too large even after compressing/,
    );
    expect(qualities).toEqual([0.82, 0.74, 0.66, 0.6]);
  });

  it("reports a format the browser can't decode (e.g. HEIC on desktop)", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.reject(new DOMException("unsupported"))),
    );

    const promise = compressImage(new File(["x"], "IMG_1.heic", { type: "image/heic" }));
    await expect(promise).rejects.toBeInstanceOf(CompressImageError);
    await expect(promise).rejects.toThrow(/"IMG_1.heic" couldn't be opened/);
  });
});
