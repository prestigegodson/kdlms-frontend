import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as studentApi from "@/api/student";
import { ApiError } from "@/api/client";
import { StudentResultsPage } from "@/features/student/StudentResultsPage";
import { resetStudentStore, useStudentStore } from "@/stores/studentStore";

vi.mock("@/api/student", async () => {
  const actual = await vi.importActual<typeof import("@/api/student")>("@/api/student");
  return { ...actual, getMyStudent: vi.fn(), listMyTerms: vi.fn() };
});

const TERM_PUBLISHED = {
  sessionId: "session-1",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  classId: "class-1",
  className: "Primary 1",
  resultsPublished: true,
  midtermPublished: false,
};

const TERM_UNPUBLISHED = {
  sessionId: "session-1",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-2",
  termName: "Second Term",
  termNumber: 2,
  classId: "class-1",
  className: "Primary 1",
  resultsPublished: false,
  midtermPublished: false,
};

function renderPage(initialPath = "/") {
  const router = createMemoryRouter([{ path: "/", element: <StudentResultsPage /> }], { initialEntries: [initialPath] });
  render(<RouterProvider router={router} />);
}

/** One published term per session, `count` past sessions named 2010/2011 upward. */
function pastSessions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...TERM_PUBLISHED,
    sessionId: `session-${i}`,
    sessionName: `${2010 + i}/${2011 + i}`,
    currentSession: false,
    termId: `term-${i}`,
  }));
}

describe("StudentResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStudentStore();
  });

  it("shows an empty state when there's no enrolment history yet", () => {
    useStudentStore.setState({ terms: [], status: "loaded" });

    renderPage();

    expect(screen.getByText("No enrolment history yet")).toBeInTheDocument();
  });

  it("lists a published term as a tappable row and an unpublished one as disabled", () => {
    useStudentStore.setState({ terms: [TERM_PUBLISHED, TERM_UNPUBLISHED], status: "loaded" });

    renderPage();

    expect(screen.getByText("2026/2027")).toBeInTheDocument();
    expect(screen.getAllByText("End of term")).toHaveLength(2);
    expect(screen.getAllByText("Not published yet")).toHaveLength(3); // midterm×2 + term 2's end-of-term
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("shows no pagination controls when every session fits on one page", () => {
    useStudentStore.setState({ terms: pastSessions(5), status: "loaded" });

    renderPage();

    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("pages sessions five at a time, newest first", async () => {
    useStudentStore.setState({ terms: pastSessions(7), status: "loaded" });
    const user = userEvent.setup();

    renderPage();

    expect(screen.getByText("2016/2017")).toBeInTheDocument();
    expect(screen.getByText("2012/2013")).toBeInTheDocument();
    expect(screen.queryByText("2011/2012")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("2011/2012")).toBeInTheDocument();
    expect(screen.getByText("2010/2011")).toBeInTheDocument();
    expect(screen.queryByText("2016/2017")).not.toBeInTheDocument();
  });

  it("opens the page named in the URL", () => {
    useStudentStore.setState({ terms: pastSessions(7), status: "loaded" });

    renderPage("/?page=2");

    expect(screen.getByText("2010/2011")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("shows a retryable error state when the load fails", async () => {
    vi.mocked(studentApi.getMyStudent).mockRejectedValue(new ApiError(500, "network down"));
    vi.mocked(studentApi.listMyTerms).mockRejectedValue(new ApiError(500, "network down"));

    renderPage();

    expect(await screen.findByText("network down")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
