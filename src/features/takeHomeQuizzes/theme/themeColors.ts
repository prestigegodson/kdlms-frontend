import type { QuizThemeStyle, ThemeCardRadius } from "@/api/quizThemes";

/**
 * The colour maths behind a quiz theme's automatic readability (the "author can't break it" rule):
 * question text always sits on a near-opaque white card, so only the accent needs care - every
 * existing control puts white text on `brand-500` (primary buttons, the progress bar, selected
 * options), so the accent is darkened until white text on it reaches WCAG AA (4.5:1), and the rest of
 * the brand ramp is derived from that readable accent. Pure functions only, so they're unit-tested
 * without a DOM.
 */

const WHITE = "#ffffff";
const BLACK = "#000000";
export const AA_TEXT_CONTRAST = 4.5;

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

/** `amount` of `other` mixed into `hex` (0 = `hex`, 1 = `other`). */
export function mix(hex: string, other: string, amount: number): string {
  const a = toRgb(hex);
  const b = toRgb(other);
  return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount) as Rgb);
}

/** WCAG 2 relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio, 1-21. */
export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** `accent`, darkened just enough for white text on it to reach AA - unchanged when it already does. */
export function readableAccent(accent: string): string {
  let candidate = accent.toLowerCase();
  for (let step = 1; contrast(candidate, WHITE) < AA_TEXT_CONTRAST && step <= 20; step++) {
    candidate = mix(accent, BLACK, step * 0.05);
  }
  return candidate;
}

/** Black or white, whichever reads better on `background` - for text placed straight on the page background. */
export function textOn(background: string): string {
  return contrast(background, WHITE) >= contrast(background, "#0f172a") ? WHITE : "#0f172a";
}

/** The `--color-brand-*` stops a themed quiz overrides, so every existing brand-coloured control follows the accent. */
export function brandRamp(accent: string): Record<string, string> {
  const base = readableAccent(accent);
  return {
    "--color-brand-50": mix(base, WHITE, 0.92),
    "--color-brand-100": mix(base, WHITE, 0.82),
    "--color-brand-200": mix(base, WHITE, 0.62),
    "--color-brand-400": mix(base, WHITE, 0.2),
    "--color-brand-500": base,
    "--color-brand-600": mix(base, BLACK, 0.18),
    "--color-brand-800": mix(base, BLACK, 0.55),
  };
}

export const CARD_RADIUS_PX: Record<ThemeCardRadius, number> = { NONE: 0, SMALL: 8, MEDIUM: 16, LARGE: 28 };

/** The page background, as CSS - an image background also needs its URL, resolved by the caller. */
export function backgroundCss(style: QuizThemeStyle, imageUrl: string | null): Record<string, string> {
  if (style.backgroundKind === "GRADIENT" && style.backgroundColor2) {
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: `linear-gradient(${style.gradientAngle ?? 180}deg, ${style.backgroundColor}, ${style.backgroundColor2})`,
    };
  }
  if (style.backgroundKind === "IMAGE" && imageUrl) {
    const tile = style.backgroundImageFit === "TILE";
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: `url("${imageUrl}")`,
      backgroundSize: tile ? "auto" : "cover",
      backgroundRepeat: tile ? "repeat" : "no-repeat",
      backgroundPosition: "center",
    };
  }
  return { backgroundColor: style.backgroundColor };
}

/** The style a new theme starts from - the platform's own look, so a teacher changes one thing at a time. */
export const DEFAULT_THEME_STYLE: QuizThemeStyle = {
  backgroundKind: "SOLID",
  backgroundColor: "#eef1fc",
  backgroundColor2: null,
  gradientAngle: null,
  backgroundImageFileId: null,
  backgroundImageFit: null,
  headerImageFileId: null,
  accentColor: "#3b4fd9",
  font: "SYSTEM",
  cardOpacity: 100,
  cardRadius: "MEDIUM",
};
