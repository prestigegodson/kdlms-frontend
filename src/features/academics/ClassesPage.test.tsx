import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as branchesApi from "@/api/branches";
import type { BranchView } from "@/api/branches";
import * as classesApi from "@/api/classes";
import type { SchoolClassView } from "@/api/classes";
import * as levelsApi from "@/api/levels";
import type { LevelView } from "@/api/levels";
import { ClassesPage } from "@/features/academics/ClassesPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return {
    ...actual,
    listClasses: vi.fn(),
    createClass: vi.fn(),
    updateClass: vi.fn(),
    activateClass: vi.fn(),
    deactivateClass: vi.fn(),
  };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return { ...actual, listLevels: vi.fn() };
});

const MAIN_BRANCH: BranchView = {
  id: "branch-1",
  schoolId: "school-1",
  name: "Main Branch",
  main: true,
  status: "ACTIVE",
};

const PRIMARY_LEVEL: LevelView = { id: "level-1", name: "PRIMARY", displayName: "Primary", rank: 4 };

const CLASS_VIEW: SchoolClassView = {
  id: "class-1",
  schoolId: "school-1",
  branchId: "branch-1",
  levelId: "level-1",
  name: "Little Star 1",
  classTeacherId: undefined,
  classTeacherName: undefined,
  status: "ACTIVE",
};

function mockClasses(classes: SchoolClassView[]) {
  vi.mocked(classesApi.listClasses).mockResolvedValue({
    content: classes,
    totalElements: classes.length,
    totalPages: 1,
    number: 0,
    size: 50,
  });
}

function renderAsSchoolAdmin() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "Ada",
      lastName: "Obi",
      role: "SCHOOL_ADMIN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <ClassesPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("ClassesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [MAIN_BRANCH],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(levelsApi.listLevels).mockResolvedValue([PRIMARY_LEVEL]);
  });

  it("lists classes with their status", async () => {
    mockClasses([CLASS_VIEW]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("Little Star 1")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("creates a class for the selected branch and level", async () => {
    mockClasses([]);
    vi.mocked(classesApi.createClass).mockResolvedValue(CLASS_VIEW);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No classes yet/);

    await user.click(screen.getByRole("button", { name: "Add class" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Little Star 1");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(classesApi.createClass).toHaveBeenCalledWith({
      branchId: "branch-1",
      levelId: "level-1",
      name: "Little Star 1",
    });
  });

  it("deactivates an active class", async () => {
    mockClasses([CLASS_VIEW]);
    vi.mocked(classesApi.deactivateClass).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Little Star 1");

    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(classesApi.deactivateClass).toHaveBeenCalledWith("class-1");
  });
});
