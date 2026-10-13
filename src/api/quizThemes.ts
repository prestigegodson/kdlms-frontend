import { apiFetch } from "@/api/client";

/**
 * A tenant's quiz themes - mirrors backend `takehomequiz` `ManageQuizThemesUseCase`. One endpoint for
 * schools and creators alike (a creator's tenant is its own school id). A quiz links to a saved theme
 * (`themeId`) or a built-in preset (`themePreset`), never both, so editing a theme restyles every quiz
 * using it.
 */
export type ThemeBackgroundKind = "SOLID" | "GRADIENT" | "IMAGE";
export type ThemeBackgroundFit = "COVER" | "TILE";
export type ThemeCardRadius = "NONE" | "SMALL" | "MEDIUM" | "LARGE";
export type QuizThemeFont = "SYSTEM" | "NUNITO" | "POPPINS" | "LEXEND" | "MERRIWEATHER" | "BALOO_2";

/**
 * Mirrors backend `QuizThemeStyle` - the look a player shows, whichever source it came from. Colours
 * are `#rrggbb`; fields a `backgroundKind` doesn't use are null. `cardOpacity` is 85-100.
 */
export interface QuizThemeStyle {
  backgroundKind: ThemeBackgroundKind;
  backgroundColor: string;
  backgroundColor2: string | null;
  gradientAngle: number | null;
  backgroundImageFileId: string | null;
  backgroundImageFit: ThemeBackgroundFit | null;
  headerImageFileId: string | null;
  accentColor: string;
  font: QuizThemeFont;
  cardOpacity: number;
  cardRadius: ThemeCardRadius;
}

export interface QuizThemePresetView {
  key: string;
  name: string;
  style: QuizThemeStyle;
}

export interface QuizThemeView {
  id: string;
  name: string;
  style: QuizThemeStyle;
  createdBy: string;
  /** Blank for a creator's own themes - they're the only author. */
  createdByName: string;
  canEdit: boolean;
  /** How many of the tenant's quizzes use it. */
  usageCount: number;
  updatedAt: string;
}

export interface QuizThemeLibraryView {
  presets: QuizThemePresetView[];
  themes: QuizThemeView[];
}

export interface SaveQuizThemeRequest {
  name: string;
  style: QuizThemeStyle;
}

const BASE = "/api/v1/quiz-themes";

export function listQuizThemes(): Promise<QuizThemeLibraryView> {
  return apiFetch<QuizThemeLibraryView>(BASE);
}

export function createQuizTheme(request: SaveQuizThemeRequest): Promise<QuizThemeView> {
  return apiFetch<QuizThemeView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateQuizTheme(themeId: string, request: SaveQuizThemeRequest): Promise<QuizThemeView> {
  return apiFetch<QuizThemeView>(`${BASE}/${themeId}`, { method: "PUT", body: JSON.stringify(request) });
}

/** The quizzes using it return to the plain look. */
export function deleteQuizTheme(themeId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${themeId}`, { method: "DELETE" });
}
