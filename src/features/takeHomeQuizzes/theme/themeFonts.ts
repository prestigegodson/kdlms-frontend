import type { QuizThemeFont } from "@/api/quizThemes";

/**
 * The curated quiz-theme fonts (backend `QuizThemeFont`), self-hosted through fontsource like the
 * app's own Inter/Lexend and loaded only when a theme actually uses one, so an unthemed quiz never
 * downloads them.
 */
export const THEME_FONTS: Record<QuizThemeFont, { label: string; family: string | null }> = {
  SYSTEM: { label: "Default (Inter)", family: null },
  NUNITO: { label: "Nunito - rounded and friendly", family: '"Nunito Variable", ui-sans-serif, sans-serif' },
  POPPINS: { label: "Poppins - geometric", family: '"Poppins", ui-sans-serif, sans-serif' },
  LEXEND: { label: "Lexend - easy to read", family: '"Lexend Variable", ui-sans-serif, sans-serif' },
  MERRIWEATHER: { label: "Merriweather - classic serif", family: '"Merriweather Variable", ui-serif, serif' },
  BALOO_2: { label: "Baloo 2 - playful", family: '"Baloo 2 Variable", ui-sans-serif, sans-serif' },
};

const LOADERS: Partial<Record<QuizThemeFont, () => Promise<unknown>>> = {
  NUNITO: () => import("@fontsource-variable/nunito"),
  POPPINS: () => Promise.all([import("@fontsource/poppins/400.css"), import("@fontsource/poppins/600.css")]),
  MERRIWEATHER: () => import("@fontsource-variable/merriweather"),
  BALOO_2: () => import("@fontsource-variable/baloo-2"),
};

const loaded = new Set<QuizThemeFont>();

/** Loads `font`'s stylesheet once; a failure just leaves the fallback font in place. */
export function loadThemeFont(font: QuizThemeFont): void {
  const loader = LOADERS[font];
  if (!loader || loaded.has(font)) return;
  loaded.add(font);
  loader().catch(() => loaded.delete(font));
}
