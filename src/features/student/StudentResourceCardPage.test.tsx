import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as learningApi from "@/api/learning";
import { StudentResourceCardPage } from "@/features/student/StudentResourceCardPage";

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return { ...actual, listMyLearningResources: vi.fn() };
});

function resource(
  overrides: Partial<learningApi.MyLearningResourceSummaryView>,
): learningApi.MyLearningResourceSummaryView {
  return {
    id: "resource",
    title: "Resource",
    description: null,
    subjectName: "Physics",
    resourceType: "PDF",
    durationSeconds: null,
    position: 0,
    completed: false,
    availableUntil: null,
    cardKind: "GROUP",
    cardId: "sciences",
    cardName: "Sciences",
    visibleSince: "2026-09-01T08:00:00Z",
    opened: true,
    ...overrides,
  };
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/student/resources/group/:cardId", element: <StudentResourceCardPage kind="GROUP" /> },
      { path: "/student/resources/subject/:cardId", element: <StudentResourceCardPage kind="SUBJECT" /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

beforeEach(() => vi.clearAllMocks());

describe("StudentResourceCardPage", () => {
  it("lists only the card's resources, marking unopened ones New and done ones Completed", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([
      resource({ id: "lab", title: "Lab safety", opened: false }),
      resource({ id: "cells", title: "Cells", completed: true }),
      resource({ id: "fractions", title: "Fractions", cardKind: "SUBJECT", cardId: "maths", cardName: "Mathematics" }),
    ]);

    renderAt("/student/resources/group/sciences");

    const labRow = (await screen.findByText("Lab safety")).closest("a");
    const cellsRow = screen.getByText("Cells").closest("a");
    expect(screen.queryByText("Fractions")).not.toBeInTheDocument();
    expect(labRow?.getAttribute("href")).toBe("/student/resources/lab");
    expect(labRow?.textContent).toContain("New");
    expect(labRow?.textContent).not.toContain("Completed");
    expect(cellsRow?.textContent).toContain("Completed");
    expect(cellsRow?.textContent).not.toContain("New");
  });

  it("shows an empty state for a card with nothing on it", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([resource({})]);

    renderAt("/student/resources/subject/sciences");

    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
  });
});
