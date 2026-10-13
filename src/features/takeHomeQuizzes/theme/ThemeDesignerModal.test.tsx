import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as quizThemesApi from "@/api/quizThemes";
import { DEFAULT_THEME_STYLE } from "@/features/takeHomeQuizzes/theme/themeColors";
import { ThemeDesignerModal } from "@/features/takeHomeQuizzes/theme/ThemeDesignerModal";

vi.mock("@/api/quizThemes", () => ({
  createQuizTheme: vi.fn(),
  updateQuizTheme: vi.fn(),
}));

const SAVED: quizThemesApi.QuizThemeView = {
  id: "theme-1",
  name: "Sports day",
  style: DEFAULT_THEME_STYLE,
  createdBy: "user-1",
  createdByName: "Tara Teacher",
  canEdit: true,
  usageCount: 0,
  updatedAt: "2026-10-01T00:00:00Z",
};

describe("ThemeDesignerModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("needs a name before saving", async () => {
    const user = userEvent.setup();
    render(
      <ThemeDesignerModal
        initial={{ name: "", style: DEFAULT_THEME_STYLE }}
        canUse
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save theme" }));
    expect(await screen.findByText("Give the theme a name.")).toBeInTheDocument();
    expect(quizThemesApi.createQuizTheme).not.toHaveBeenCalled();
  });

  it("saves a gradient theme and hands it back to be used", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    vi.mocked(quizThemesApi.createQuizTheme).mockResolvedValue(SAVED);
    render(
      <ThemeDesignerModal
        initial={{ name: "", style: DEFAULT_THEME_STYLE }}
        canUse
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await user.type(screen.getByLabelText("Name"), "Sports day");
    await user.click(screen.getByRole("radio", { name: "Gradient" }));
    await user.click(screen.getByRole("radio", { name: "Round" }));
    await user.click(screen.getByRole("button", { name: "Save & use on this quiz" }));

    expect(quizThemesApi.createQuizTheme).toHaveBeenCalledWith({
      name: "Sports day",
      style: expect.objectContaining({
        backgroundKind: "GRADIENT",
        backgroundColor2: "#1e3a8a",
        gradientAngle: 135,
        cardRadius: "LARGE",
        backgroundImageFileId: null,
      }),
    });
    expect(onSaved).toHaveBeenCalledWith(SAVED, true);
  });

  it("warns that editing a theme in use restyles those quizzes", () => {
    render(
      <ThemeDesignerModal
        initial={{ name: SAVED.name, style: SAVED.style }}
        editing={{ ...SAVED, usageCount: 3 }}
        canUse={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText("Changes apply to 3 quizzes immediately.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save & use on this quiz" })).toBeNull();
  });
});
