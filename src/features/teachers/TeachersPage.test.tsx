import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSummary } from "@/api/auth";
import * as branchesApi from "@/api/branches";
import type { BranchView } from "@/api/branches";
import * as usersApi from "@/api/users";
import type { CreateUserResult } from "@/api/users";
import { TeachersPage } from "@/features/teachers/TeachersPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/users", async () => {
  const actual = await vi.importActual<typeof import("@/api/users")>("@/api/users");
  return { ...actual, listTeachers: vi.fn(), createTeacher: vi.fn() };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

const MAIN_BRANCH: BranchView = {
  id: "branch-1",
  schoolId: "school-1",
  name: "Main Branch",
  main: true,
  status: "ACTIVE",
};

const TEACHER: UserSummary = {
  id: "teacher-1",
  email: "sonia@school.example",
  firstName: "Sonia",
  lastName: "B",
  role: "TEACHER",
  schoolId: "school-1",
  branchId: "branch-1",
};

function mockTeachers(teachers: UserSummary[]) {
  vi.mocked(usersApi.listTeachers).mockResolvedValue({
    content: teachers,
    totalElements: teachers.length,
    totalPages: 1,
    number: 0,
    size: 20,
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
  render(<TeachersPage />);
}

describe("TeachersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [MAIN_BRANCH],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
  });

  it("lists teachers with their branch", async () => {
    mockTeachers([TEACHER]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("sonia@school.example")).toBeInTheDocument();
    expect(await screen.findByText("Main Branch")).toBeInTheDocument();
  });

  it("creates a teacher and keeps the temporary password collapsed until revealed", async () => {
    mockTeachers([]);
    const created: CreateUserResult = { user: TEACHER, temporaryPassword: "Xk4p-9Fmz" };
    vi.mocked(usersApi.createTeacher).mockResolvedValue(created);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No teachers yet/);

    await user.click(screen.getByRole("button", { name: "Add teacher" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("First name"), "Sonia");
    await user.type(within(dialog).getByLabelText("Last name"), "B");
    await user.type(within(dialog).getByLabelText("Email"), "sonia@school.example");
    await user.click(within(dialog).getByRole("button", { name: "Create teacher" }));

    expect(usersApi.createTeacher).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Sonia",
        lastName: "B",
        email: "sonia@school.example",
        branchId: "branch-1",
      }),
    );

    const confirmDialog = await screen.findByRole("dialog");
    expect(within(confirmDialog).getByText(/welcome email has been sent/)).toBeInTheDocument();
    expect(within(confirmDialog).queryByText("Xk4p-9Fmz")).not.toBeInTheDocument();

    await user.click(within(confirmDialog).getByRole("button", { name: /Show credentials/ }));
    expect(within(confirmDialog).getByText("Xk4p-9Fmz")).toBeInTheDocument();
  });
});
