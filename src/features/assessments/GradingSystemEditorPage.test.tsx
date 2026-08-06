import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as gradingApi from "@/api/gradingSystems";
import type { GradingSystemView } from "@/api/gradingSystems";
import { GradingSystemEditorPage } from "@/features/assessments/GradingSystemEditorPage";

vi.mock("@/api/gradingSystems", async () => {
  const actual = await vi.importActual<typeof import("@/api/gradingSystems")>("@/api/gradingSystems");
  return { ...actual, getGradingSystem: vi.fn(), saveNumericGradingSystem: vi.fn(), saveQualitativeGradingSystem: vi.fn() };
});

const NUMERIC_SYSTEM: GradingSystemView = {
  levelId: "level-1",
  levelName: "Primary",
  baseLevel: "PRIMARY",
  assessmentMode: "NUMERIC",
  quizWeight: 30,
  examWeight: 70,
  quizMax: 100,
  examMax: 100,
  showPosition: true,
  boundaries: [
    { grade: "A", minScore: 70, maxScore: 100, remark: "Excellent" },
    { grade: "F", minScore: 0, maxScore: 69.99, remark: "Fail" },
  ],
  ratingOptions: [],
  configured: true,
};

function renderPage() {
  const router = createMemoryRouter(
    [{ path: "/grading/:levelId", element: <GradingSystemEditorPage /> }],
    { initialEntries: ["/grading/level-1"] },
  );
  render(<RouterProvider router={router} />);
}

describe("GradingSystemEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gradingApi.getGradingSystem).mockResolvedValue(NUMERIC_SYSTEM);
  });

  it("toggling the mode swaps between the boundary editor and the rating-scale editor", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Grade boundaries")).toBeInTheDocument();
    expect(screen.queryByText("Rating scale")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Qualitative" }));

    expect(screen.getByText("Rating scale")).toBeInTheDocument();
    expect(screen.queryByText("Grade boundaries")).not.toBeInTheDocument();
  });

  it("rejects a boundary gap client-side and never calls the save endpoint", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Grade boundaries");
    // Introduce a gap: A's min moves to 71, leaving 69.99-71 uncovered.
    const minInputs = screen.getAllByLabelText("Min score");
    await user.clear(minInputs[0]);
    await user.type(minInputs[0], "71");

    await user.click(screen.getByRole("button", { name: "Save grading system" }));

    expect(await screen.findByText(/no gaps or overlaps/)).toBeInTheDocument();
    expect(gradingApi.saveNumericGradingSystem).not.toHaveBeenCalled();
  });

  it("show position defaults to checked and saves true when left alone", async () => {
    const user = userEvent.setup();
    vi.mocked(gradingApi.saveNumericGradingSystem).mockResolvedValue(NUMERIC_SYSTEM);
    renderPage();

    const checkbox = await screen.findByRole("checkbox", { name: /show class position on reports/i });
    expect(checkbox).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Save grading system" }));

    expect(gradingApi.saveNumericGradingSystem).toHaveBeenCalledWith(
      "level-1",
      expect.objectContaining({ showPosition: true }),
    );
  });

  it("unchecking show position sends showPosition: false", async () => {
    const user = userEvent.setup();
    vi.mocked(gradingApi.saveNumericGradingSystem).mockResolvedValue({ ...NUMERIC_SYSTEM, showPosition: false });
    renderPage();

    const checkbox = await screen.findByRole("checkbox", { name: /show class position on reports/i });
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "Save grading system" }));

    expect(gradingApi.saveNumericGradingSystem).toHaveBeenCalledWith(
      "level-1",
      expect.objectContaining({ showPosition: false }),
    );
  });
});
