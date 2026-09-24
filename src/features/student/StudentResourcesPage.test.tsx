import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as learningApi from "@/api/learning";
import { StudentResourcesPage } from "@/features/student/StudentResourcesPage";

vi.mock("@/api/learning", async () => {
  const actual = await vi.importActual<typeof import("@/api/learning")>("@/api/learning");
  return { ...actual, listMyLearningResources: vi.fn() };
});

const RESOURCE_COMPLETED: learningApi.MyLearningResourceSummaryView = {
  id: "resource-1",
  title: "Fractions Explainer",
  description: null,
  subjectName: "Mathematics",
  resourceType: "VIDEO",
  durationSeconds: 300,
  position: 0,
  completed: true,
  availableUntil: null,
};

const RESOURCE_INCOMPLETE: learningApi.MyLearningResourceSummaryView = {
  id: "resource-2",
  title: "Reading Log",
  description: null,
  subjectName: "English",
  resourceType: "PDF",
  durationSeconds: null,
  position: 0,
  completed: false,
  availableUntil: null,
};

function renderPage() {
  const router = createMemoryRouter([{ path: "/", element: <StudentResourcesPage /> }], {
    initialEntries: ["/"],
  });
  render(<RouterProvider router={router} />);
}

beforeEach(() => vi.clearAllMocks());

describe("StudentResourcesPage", () => {
  it("shows a Completed badge only on a resource the student has marked done", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([RESOURCE_COMPLETED, RESOURCE_INCOMPLETE]);

    renderPage();

    await screen.findByText("Fractions Explainer");
    const completedRow = screen.getByText("Fractions Explainer").closest("a");
    const incompleteRow = screen.getByText("Reading Log").closest("a");
    expect(completedRow).not.toBeNull();
    expect(incompleteRow).not.toBeNull();
    expect(completedRow?.textContent).toContain("Completed");
    expect(incompleteRow?.textContent).not.toContain("Completed");
  });

  it("shows an empty state when nothing has been published", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No resources yet")).toBeInTheDocument();
  });
});
