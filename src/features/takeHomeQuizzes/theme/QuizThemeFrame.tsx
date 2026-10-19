import { type CSSProperties, type ReactNode, useEffect } from "react";
import type { QuizThemeStyle } from "@/api/quizThemes";
import { backgroundCss, brandRamp, CARD_RADIUS_PX } from "@/features/takeHomeQuizzes/theme/themeColors";
import { loadThemeFont, THEME_FONTS } from "@/features/takeHomeQuizzes/theme/themeFonts";
import { type ThemeImageSource, useThemeImageUrl } from "@/features/takeHomeQuizzes/theme/themeImages";

interface QuizThemeFrameProps {
  /** Null/undefined renders `children` untouched - an unthemed quiz looks exactly as it always did. */
  theme: QuizThemeStyle | null | undefined;
  images: ThemeImageSource;
  /**
   * `page` fills the viewport (the public token page); `embedded` is a panel inside the portal shell;
   * `compact` is a thumbnail (the theme gallery's swatches).
   */
  variant?: "page" | "embedded" | "compact";
  /** A `page` widens from `lg` up for a quiz with reading passages, which sit beside the question there (Phase 20L). */
  wide?: boolean;
  children: ReactNode;
}

/**
 * Dresses a quiz-taking screen in its theme: the background, a header banner, the font, and the
 * accent. Everything the student reads sits on one near-opaque white surface (backend
 * `QuizThemeStyle.MIN_CARD_OPACITY`), and the accent reaches every existing control by overriding the
 * `--color-brand-*` tokens for this subtree with a readable version of it (`brandRamp`) - so no
 * player component needs to know themes exist, and none can end up unreadable.
 */
export function QuizThemeFrame({ theme, images, variant = "embedded", wide = false, children }: QuizThemeFrameProps) {
  const backgroundUrl = useThemeImageUrl(
    images,
    theme?.backgroundKind === "IMAGE" ? theme.backgroundImageFileId : null,
  );
  const headerUrl = useThemeImageUrl(images, theme?.headerImageFileId ?? null);
  const font = theme?.font;

  useEffect(() => {
    if (font) loadThemeFont(font);
  }, [font]);

  if (!theme) {
    return <>{children}</>;
  }

  const radius = CARD_RADIUS_PX[theme.cardRadius];
  const family = THEME_FONTS[theme.font].family;
  const frameStyle = {
    ...brandRamp(theme.accentColor),
    "--radius-card": `${Math.min(radius, 16)}px`,
    ...(family ? { "--font-sans": family, "--font-display": family, fontFamily: family } : {}),
    ...backgroundCss(theme, backgroundUrl),
  } as CSSProperties;
  const page = variant === "page";
  const compact = variant === "compact";

  return (
    <div
      data-quiz-theme=""
      style={frameStyle}
      className={
        // `overflow-clip`, not `-hidden`: it rounds the background the same way without becoming a
        // scroll container, which would stop the quiz's sticky action bar from sticking.
        page ? "min-h-dvh px-3 py-4 sm:px-4 sm:py-8" : compact ? "p-2" : "overflow-clip rounded-card p-3 sm:p-5"
      }
    >
      <div className={page ? `mx-auto max-w-2xl ${wide ? "lg:max-w-6xl" : ""}` : undefined}>
        {theme.headerImageFileId && (
          <div
            className={`aspect-[4/1] w-full overflow-hidden bg-white/40 shadow-sm ${compact ? "mb-1.5" : "mb-3 sm:mb-4"}`}
            style={{ borderRadius: radius }}
          >
            {headerUrl && <img src={headerUrl} alt="" className="h-full w-full object-cover" />}
          </div>
        )}
        <div
          data-quiz-theme-surface=""
          className={compact ? "p-2 shadow" : "p-4 shadow-lg sm:p-6"}
          style={{
            backgroundColor: `rgba(255, 255, 255, ${theme.cardOpacity / 100})`,
            borderRadius: compact ? Math.min(radius, 8) : radius,
            backdropFilter: theme.cardOpacity < 100 ? "blur(6px)" : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
