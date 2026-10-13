import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuizThemeFrame } from "@/features/takeHomeQuizzes/theme/QuizThemeFrame";
import { DEFAULT_THEME_STYLE, readableAccent } from "@/features/takeHomeQuizzes/theme/themeColors";
import type { ThemeImageSource } from "@/features/takeHomeQuizzes/theme/themeImages";

const URL_IMAGES: ThemeImageSource = { kind: "url", urlFor: (fileId) => `/images/${fileId}` };

describe("QuizThemeFrame", () => {
  it("renders an unthemed quiz untouched", () => {
    const { container } = render(
      <QuizThemeFrame theme={null} images={URL_IMAGES}>
        <p>Question</p>
      </QuizThemeFrame>,
    );
    expect(container.querySelector("[data-quiz-theme]")).toBeNull();
    expect(screen.getByText("Question")).toBeInTheDocument();
  });

  it("scopes the readable accent, background, surface and header to the quiz", () => {
    const { container } = render(
      <QuizThemeFrame
        theme={{ ...DEFAULT_THEME_STYLE, accentColor: "#fde047", headerImageFileId: "header-1", cardOpacity: 90 }}
        images={URL_IMAGES}
      >
        <p>Question</p>
      </QuizThemeFrame>,
    );
    const frame = container.querySelector<HTMLElement>("[data-quiz-theme]")!;
    expect(frame.style.getPropertyValue("--color-brand-500")).toBe(readableAccent("#fde047"));
    expect(frame.style.backgroundColor).toBe("rgb(238, 241, 252)");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/images/header-1");
    const surface = container.querySelector<HTMLElement>("[data-quiz-theme-surface]")!;
    expect(surface.style.backgroundColor).toBe("rgba(255, 255, 255, 0.9)");
    expect(surface).toContainElement(screen.getByText("Question"));
  });
});
