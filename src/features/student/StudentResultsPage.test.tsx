import { render, screen } from "@testing-library/react";
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

function renderPage() {
  const router = createMemoryRouter([{ path: "/", element: <StudentResultsPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
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

  it("shows a retryable error state when the load fails", async () => {
    vi.mocked(studentApi.getMyStudent).mockRejectedValue(new ApiError(500, "network down"));
    vi.mocked(studentApi.listMyTerms).mockRejectedValue(new ApiError(500, "network down"));

    renderPage();

    expect(await screen.findByText("network down")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
