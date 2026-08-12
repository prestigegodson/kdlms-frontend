import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as attendanceApi from "@/api/attendance";
import * as branchesApi from "@/api/branches";
import * as classesApi from "@/api/classes";
import * as levelsApi from "@/api/levels";
import * as meApi from "@/api/me";
import { AttendancePage } from "@/features/attendance/AttendancePage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";
import { resetLevelStore } from "@/stores/levelStore";

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn() };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return { ...actual, listLevels: vi.fn() };
});

vi.mock("@/api/attendance", async () => {
  const actual = await vi.importActual<typeof import("@/api/attendance")>("@/api/attendance");
  return { ...actual, getDailyOverview: vi.fn() };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

function renderAs(role: "TEACHER" | "SCHOOL_ADMIN") {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "user@school.example",
      firstName: "A",
      lastName: "B",
      role,
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <AttendancePage /> }], {
    initialEntries: ["/"],
  });
  render(<RouterProvider router={router} />);
}

describe("AttendancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLevelStore();
    resetBranchStore();
    vi.mocked(meApi.listMyClasses).mockResolvedValue([]);
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 200,
    });
    vi.mocked(levelsApi.listLevels).mockResolvedValue([]);
    vi.mocked(attendanceApi.getDailyOverview).mockResolvedValue({
      date: "2026-09-14",
      totalClasses: 0,
      classesMarked: 0,
      classes: [],
    });
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [{ id: "branch-1", schoolId: "school-1", name: "Main Branch", main: true, status: "ACTIVE" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
  });

  it("shows the marking flow, with no marking controls visible, for a TEACHER with no class-taught classes", async () => {
    renderAs("TEACHER");

    expect(await screen.findByText("No classes to register")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("shows the read-only admin view for a SCHOOL_ADMIN, narrowed to the auto-selected branch, with no marking controls anywhere on the page", async () => {
    renderAs("SCHOOL_ADMIN");

    expect(
      await screen.findByText("Review a class's daily register or its totals for a term."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Today’s attendance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark register" })).not.toBeInTheDocument();
    expect(await screen.findAllByLabelText("Branch")).not.toHaveLength(0);
    expect(attendanceApi.getDailyOverview).toHaveBeenCalledWith(expect.any(String), "branch-1");
    expect(classesApi.listClasses).toHaveBeenCalledWith("branch-1", undefined, 0, 200);
  });
});
