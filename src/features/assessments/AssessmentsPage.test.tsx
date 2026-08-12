import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as branchesApi from "@/api/branches";
import * as classesApi from "@/api/classes";
import * as meApi from "@/api/me";
import { AssessmentsPage } from "@/features/assessments/AssessmentsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn() };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

function renderAs(role: "TEACHER" | "SCHOOL_ADMIN") {
  resetAuthStore();
  useAuthStore.setState({
    user: { id: "user-1", email: "user@school.example", firstName: "A", lastName: "B", role, schoolId: "school-1" },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <AssessmentsPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("AssessmentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBranchStore();
    vi.mocked(meApi.listMyClasses).mockResolvedValue([]);
    vi.mocked(classesApi.listClasses).mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 200 });
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [{ id: "branch-1", schoolId: "school-1", name: "Main Branch", main: true, status: "ACTIVE" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
  });

  it("shows the recording flow for a TEACHER", async () => {
    renderAs("TEACHER");

    expect(await screen.findByText("Record scores")).toBeInTheDocument();
  });

  it("shows the read-only results view for a SCHOOL_ADMIN, narrowed to the auto-selected branch", async () => {
    renderAs("SCHOOL_ADMIN");

    expect(await screen.findByText("Pick a class and term to see its results.")).toBeInTheDocument();
    expect(await screen.findByLabelText("Branch")).toBeInTheDocument();
    expect(classesApi.listClasses).toHaveBeenCalledWith("branch-1", undefined, 0, 200);
  });
});
