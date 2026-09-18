import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as studentApi from "@/api/student";
import { StudentDashboardPage } from "@/features/student/StudentDashboardPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetStudentStore } from "@/stores/studentStore";

vi.mock("@/api/student", async () => {
  const actual = await vi.importActual<typeof import("@/api/student")>("@/api/student");
  return {
    ...actual,
    getMyStudent: vi.fn(),
    listMyTerms: vi.fn(),
    downloadMyPhoto: vi.fn(),
  };
});

const ME = {
  studentId: "s1",
  fullName: "Grace Ward",
  admissionNumber: "KDL/24/001",
  gender: "FEMALE" as const,
  hasPhoto: false,
  classId: "class-1",
  className: "Primary 1",
  levelName: "Primary",
  sessionId: "session-1",
  sessionName: "2026/2027",
  currentTermId: "term-1",
  currentTermName: "First Term",
  branchId: "branch-1",
  schoolId: "school-1",
  schoolName: "Portal School",
};

function renderPage() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "student-1",
      email: "grace-kdl24001",
      firstName: "Grace",
      lastName: "Ward",
      role: "STUDENT",
      schoolId: "school-1",
      branchId: "branch-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <StudentDashboardPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("StudentDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStudentStore();
    vi.mocked(studentApi.listMyTerms).mockResolvedValue([]);
  });

  it("shows the caller's own name, admission number, and class once loaded", async () => {
    vi.mocked(studentApi.getMyStudent).mockResolvedValue(ME);

    renderPage();

    expect(await screen.findByText("Grace Ward")).toBeInTheDocument();
    expect(screen.getByText("KDL/24/001")).toBeInTheDocument();
    expect(screen.getByText("Primary 1 · Primary")).toBeInTheDocument();
  });

  it("never fetches a photo for a student with none set", async () => {
    vi.mocked(studentApi.getMyStudent).mockResolvedValue(ME);

    renderPage();

    await screen.findByText("Grace Ward");
    expect(studentApi.downloadMyPhoto).not.toHaveBeenCalled();
  });

  it("shows a retryable error state when the profile fails to load", async () => {
    vi.mocked(studentApi.getMyStudent)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(ME);
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Grace Ward")).toBeInTheDocument();
  });
});
