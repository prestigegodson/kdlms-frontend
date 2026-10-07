import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as learningApi from "@/api/learning";
import { StudentResourcesPage } from "@/features/student/StudentResourcesPage";

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
    subjectName: "Mathematics",
    resourceType: "PDF",
    durationSeconds: null,
    position: 0,
    completed: false,
    availableUntil: null,
    cardKind: "SUBJECT",
    cardId: "maths",
    cardName: "Mathematics",
    visibleSince: "2026-09-01T08:00:00Z",
    opened: true,
    ...overrides,
  };
}

function renderPage() {
  const router = createMemoryRouter([{ path: "/", element: <StudentResourcesPage /> }], {
    initialEntries: ["/"],
  });
  render(<RouterProvider router={router} />);
}

beforeEach(() => vi.clearAllMocks());

describe("StudentResourcesPage", () => {
  it("shows one card per subject or group, most recently visible first, with counts and a new pill", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([
      resource({ id: "m1", completed: true, visibleSince: "2026-09-01T08:00:00Z" }),
      resource({ id: "m2", visibleSince: "2026-09-02T08:00:00Z" }),
      resource({
        id: "s1",
        subjectName: "Physics",
        cardKind: "GROUP",
        cardId: "sciences",
        cardName: "Sciences",
        opened: false,
        visibleSince: "2026-09-10T08:00:00.123456Z",
      }),
      resource({
        id: "s2",
        subjectName: "Sciences",
        subjectGroupId: "sciences",
        cardKind: "GROUP",
        cardId: "sciences",
        cardName: "Sciences",
        completed: true,
        opened: false,
        visibleSince: "2026-09-03T08:00:00Z",
      }),
    ]);

    renderPage();

    await screen.findByText("Sciences");
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/student/resources/group/sciences",
      "/student/resources/subject/maths",
    ]);
    expect(links[0].textContent).toContain("2 resources · 1 not completed");
    expect(links[0].textContent).toContain("2 new");
    expect(links[1].textContent).toContain("2 resources · 1 not completed");
    expect(links[1].textContent).not.toContain("new");
  });

  it("says a card is all completed once every resource on it is done", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([resource({ completed: true })]);

    renderPage();

    expect(await screen.findByText("1 resource · All completed")).toBeInTheDocument();
  });

  it("shows an empty state when nothing has been published", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No resources yet")).toBeInTheDocument();
  });
});
