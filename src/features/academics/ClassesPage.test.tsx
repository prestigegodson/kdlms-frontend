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
import { resetBranchStore } from "@/stores/branchStore";
import { resetLevelStore } from "@/stores/levelStore";

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

const ANNEX_BRANCH: BranchView = {
  id: "branch-2",
  schoolId: "school-1",
  name: "Annex Campus",
  main: false,
  status: "ACTIVE",
};

const PRIMARY_LEVEL: LevelView = {
  id: "level-1",
  baseLevel: "PRIMARY",
  displayName: "Primary",
  rank: 4,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 0,
  subjectGroupCount: 0,
};

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
  const router = createMemoryRouter(
    [
      { path: "/", element: <ClassesPage /> },
      { path: "/school/academics/classes/:classId", element: <div>Class detail page</div> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("ClassesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLevelStore();
    resetBranchStore();
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [MAIN_BRANCH, ANNEX_BRANCH],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(levelsApi.listLevels).mockResolvedValue([PRIMARY_LEVEL]);
  });

  it("lists classes with their status and level", async () => {
    mockClasses([CLASS_VIEW]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("Little Star 1")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Primary")).toBeInTheDocument();
  });

  it("defaults to the school's main branch", async () => {
    mockClasses([CLASS_VIEW]);

    renderAsSchoolAdmin();

    await screen.findByText("Little Star 1");
    expect(screen.getByLabelText("Branch")).toHaveValue("branch-1");
    expect(classesApi.listClasses).toHaveBeenCalledWith("branch-1", undefined);
  });

  it("widens to every branch", async () => {
    mockClasses([CLASS_VIEW]);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Little Star 1");

    await user.selectOptions(screen.getByLabelText("Branch"), "All branches");

    expect(classesApi.listClasses).toHaveBeenCalledWith(undefined, undefined);
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
    // The row itself is also a nav target (TableRow's `to`) - clicking the
    // inline action must stop propagation rather than also navigating away.
    expect(screen.getByText("Little Star 1")).toBeInTheDocument();
    expect(screen.queryByText("Class detail page")).not.toBeInTheDocument();
  });

  it("navigates to the class detail route when a row is tapped", async () => {
    mockClasses([CLASS_VIEW]);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Little Star 1");

    const row = screen.getByText("Little Star 1").closest("tr")!;
    expect(row).toHaveAttribute("tabindex", "0");

    await user.click(row);

    expect(await screen.findByText("Class detail page")).toBeInTheDocument();
  });
});
