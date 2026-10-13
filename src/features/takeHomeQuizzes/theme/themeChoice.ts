/**
 * What a quiz wears: a saved theme of its tenant, a built-in preset, or neither (the plain look) -
 * never both, mirroring backend `TakeHomeQuiz#updateTheme`. Sent on every quiz save as a full replace.
 */
export interface ThemeChoice {
  themeId: string | null;
  themePreset: string | null;
}

export const NO_THEME: ThemeChoice = { themeId: null, themePreset: null };
