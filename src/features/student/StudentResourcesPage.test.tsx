import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function renderPage(entry = "/student/resources") {
  const router = createMemoryRouter([{ path: "/student/resources", element: <StudentResourcesPage /> }], {
    initialEntries: [entry],
  });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => vi.clearAllMocks());

describe("StudentResourcesPage", () => {
  it("opens on the Open tab, listing only incomplete resources newest first", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([
      resource({ id: "old", title: "Fractions", visibleSince: "2026-09-01T08:00:00Z" }),
      resource({ id: "done", title: "Done one", completed: true, visibleSince: "2026-09-20T08:00:00Z" }),
      resource({ id: "new", title: "Atoms", visibleSince: "2026-09-10T08:00:00.123456Z" }),
    ]);

    renderPage();

    await screen.findByText("Atoms");
    expect(screen.getByRole("tab", { name: "Open" })).toHaveAttribute("aria-selected", "true");
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/student/resources/new",
      "/student/resources/old",
    ]);
    expect(screen.queryByText("Done one")).not.toBeInTheDocument();
  });

  it("names the group, shows the type icon, and marks unopened resources as new", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([
      resource({
        id: "s1",
        title: "Cells video",
        subjectName: "Biology",
        resourceType: "YOUTUBE",
        cardKind: "GROUP",
        cardId: "sciences",
        cardName: "Sciences",
        opened: false,
        visibleSince: "2026-09-10T08:00:00Z",
      }),
      resource({ id: "m1", title: "Algebra notes", resourceType: "RICH_TEXT" }),
    ]);

    renderPage();

    const [science, maths] = await screen.findAllByRole("link");
    expect(within(science).getByText("Sciences")).toBeInTheDocument();
    expect(within(science).getByRole("img", { name: "YouTube" })).toBeInTheDocument();
    expect(within(science).getByText("New")).toBeInTheDocument();
    expect(within(maths).getByText("Mathematics")).toBeInTheDocument();
    expect(within(maths).getByRole("img", { name: "Note" })).toBeInTheDocument();
    expect(within(maths).queryByText("New")).not.toBeInTheDocument();
  });

  it("shows an Available until footer only when the window has an end", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([
      resource({ id: "a", title: "Ending", availableUntil: "2026-10-10T08:00:00Z" }),
      resource({ id: "b", title: "Forever", visibleSince: "2026-08-01T08:00:00Z" }),
    ]);

    renderPage();

    const [ending, forever] = await screen.findAllByRole("link");
    expect(within(ending).getByText(/Available until/)).toBeInTheDocument();
    expect(within(forever).queryByText(/Available until/)).not.toBeInTheDocument();
  });

  it("switches to the Completed tab and keeps it in the URL", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([
      resource({ id: "open", title: "Still open" }),
      resource({ id: "done", title: "Finished", completed: true }),
    ]);

    const router = renderPage();
    await screen.findByText("Still open");

    await userEvent.click(screen.getByRole("tab", { name: "Completed" }));

    expect(await screen.findByText("Finished")).toBeInTheDocument();
    expect(screen.queryByText("Still open")).not.toBeInTheDocument();
    expect(screen.getByText("Completed", { selector: "span" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?tab=completed");
  });

  it("starts on the tab named in the URL", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([
      resource({ id: "done", title: "Finished", completed: true }),
    ]);

    renderPage("/student/resources?tab=completed");

    expect(await screen.findByText("Finished")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Completed" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows each tab's own empty state", async () => {
    vi.mocked(learningApi.listMyLearningResources).mockResolvedValue([
      resource({ id: "done", title: "Finished", completed: true }),
    ]);

    renderPage();

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    vi.mocked(learningApi.listMyLearningResources)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce([resource({ title: "Recovered" })]);

    renderPage();

    expect(await screen.findByText("Failed to load your resources")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry|try again/i }));
    expect(await screen.findByText("Recovered")).toBeInTheDocument();
  });
});
