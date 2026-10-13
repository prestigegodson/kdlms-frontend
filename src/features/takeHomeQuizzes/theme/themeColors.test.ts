import { describe, expect, it } from "vitest";
import {
  AA_TEXT_CONTRAST,
  backgroundCss,
  brandRamp,
  contrast,
  DEFAULT_THEME_STYLE,
  readableAccent,
} from "@/features/takeHomeQuizzes/theme/themeColors";

describe("themeColors", () => {
  it("measures WCAG contrast", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("leaves an already-readable accent alone", () => {
    expect(readableAccent("#3B4FD9")).toBe("#3b4fd9");
  });

  it.each(["#fde047", "#f59e0b", "#a5f3fc", "#ffffff"])(
    "darkens a light accent (%s) until white text on it reaches AA",
    (accent) => {
      const readable = readableAccent(accent);
      expect(contrast(readable, "#ffffff")).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    },
  );

  it("derives the brand ramp from the readable accent", () => {
    const ramp = brandRamp("#fde047");
    expect(ramp["--color-brand-500"]).toBe(readableAccent("#fde047"));
    expect(contrast(ramp["--color-brand-600"], "#ffffff")).toBeGreaterThan(AA_TEXT_CONTRAST);
  });

  it("renders each background kind", () => {
    expect(backgroundCss(DEFAULT_THEME_STYLE, null)).toEqual({ backgroundColor: "#eef1fc" });
    expect(
      backgroundCss({ ...DEFAULT_THEME_STYLE, backgroundKind: "GRADIENT", backgroundColor2: "#000000", gradientAngle: 90 }, null)
        .backgroundImage,
    ).toBe("linear-gradient(90deg, #eef1fc, #000000)");
    const image = backgroundCss(
      { ...DEFAULT_THEME_STYLE, backgroundKind: "IMAGE", backgroundImageFileId: "f1", backgroundImageFit: "TILE" },
      "blob:x",
    );
    expect(image.backgroundImage).toBe('url("blob:x")');
    expect(image.backgroundRepeat).toBe("repeat");
    // Until the image URL resolves, the fallback colour shows.
    expect(
      backgroundCss({ ...DEFAULT_THEME_STYLE, backgroundKind: "IMAGE", backgroundImageFileId: "f1" }, null),
    ).toEqual({ backgroundColor: "#eef1fc" });
  });
});
