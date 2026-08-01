import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as attendanceApi from "@/api/attendance";
import * as classesApi from "@/api/classes";
import * as meApi from "@/api/me";
import { AttendancePage } from "@/features/attendance/AttendancePage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn() };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/attendance", async () => {
  const actual = await vi.importActual<typeof import("@/api/attendance")>("@/api/attendance");
  return { ...actual, getDailyOverview: vi.fn() };
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
    vi.mocked(meApi.listMyClasses).mockResolvedValue([]);
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 200,
    });
    vi.mocked(attendanceApi.getDailyOverview).mockResolvedValue({
      date: "2026-09-14",
      totalClasses: 0,
      classesMarked: 0,
      classes: [],
    });
  });

  it("shows the marking flow, with no marking controls visible, for a TEACHER with no class-taught classes", async () => {
    renderAs("TEACHER");

    expect(await screen.findByText("No classes to register")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("shows the read-only admin view for a SCHOOL_ADMIN, with no marking controls anywhere on the page", async () => {
    renderAs("SCHOOL_ADMIN");

    expect(
      await screen.findByText("Review a class's daily register or its totals for a term."),
    ).toBeInTheDocument();
    expect(screen.getByText("Today’s attendance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark register" })).not.toBeInTheDocument();
  });
});
