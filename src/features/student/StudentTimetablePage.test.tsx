import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as studentApi from "@/api/student";
import { ApiError } from "@/api/client";
import { StudentTimetablePage } from "@/features/student/StudentTimetablePage";
import { resetStudentStore, useStudentStore } from "@/stores/studentStore";

vi.mock("@/api/student", async () => {
  const actual = await vi.importActual<typeof import("@/api/student")>("@/api/student");
  return { ...actual, getMyClassTimetable: vi.fn(), getMyStudent: vi.fn(), listMyTerms: vi.fn() };
});

const TERM = {
  sessionId: "sess-1",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  classId: "class-1",
  className: "Primary 1",
  resultsPublished: false,
  midtermPublished: false,
};

const EMPTY_VIEW = {
  classId: "class-1",
  className: "Primary 1",
  termId: "term-1",
  editable: false,
  periods: [],
  suggestedTeachers: {},
};

function renderPage() {
  const router = createMemoryRouter([{ path: "/", element: <StudentTimetablePage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("StudentTimetablePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStudentStore();
  });

  it("defaults to the current session's highest term number and fetches its timetable", async () => {
    useStudentStore.setState({ terms: [TERM], status: "loaded" });
    vi.mocked(studentApi.getMyClassTimetable).mockResolvedValue(EMPTY_VIEW);

    renderPage();

    expect(await screen.findByText("No timetable yet")).toBeInTheDocument();
    expect(studentApi.getMyClassTimetable).toHaveBeenCalledWith("term-1");
  });

  it("shows a retryable error state when the student profile fails to load", async () => {
    vi.mocked(studentApi.getMyStudent).mockRejectedValue(new ApiError(500, "network down"));
    vi.mocked(studentApi.listMyTerms).mockRejectedValue(new ApiError(500, "network down"));

    renderPage();

    expect(await screen.findByText("network down")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("renders the grid read-only once a non-empty timetable loads", async () => {
    useStudentStore.setState({ terms: [TERM], status: "loaded" });
    vi.mocked(studentApi.getMyClassTimetable).mockResolvedValue({
      ...EMPTY_VIEW,
      periods: [
        {
          periodId: "p1",
          position: 1,
          label: "Period 1",
          startTime: "08:00",
          endTime: "08:40",
          kind: "TEACHING",
          cellsByDay: {},
        },
      ],
    });

    renderPage();

    expect(await screen.findByText("Period 1")).toBeInTheDocument();
  });
});
