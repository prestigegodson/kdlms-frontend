import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as branchesApi from "@/api/branches";
import type { BranchView } from "@/api/branches";
import * as usersApi from "@/api/users";
import type { CreateUserResult, SchoolUserView } from "@/api/users";
import { AdministratorsPage } from "@/features/administrators/AdministratorsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";

vi.mock("@/api/users", async () => {
  const actual = await vi.importActual<typeof import("@/api/users")>("@/api/users");
  return {
    ...actual,
    listAdmins: vi.fn(),
    createBranchAdmin: vi.fn(),
    updateBranchAdmin: vi.fn(),
    disableUser: vi.fn(),
    enableUser: vi.fn(),
  };
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

const SELF: SchoolUserView = {
  id: "user-1",
  email: "admin@school.example",
  firstName: "Ada",
  lastName: "Obi",
  role: "SCHOOL_ADMIN",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00Z",
};

const BRANCH_ADMIN: SchoolUserView = {
  id: "branch-admin-1",
  email: "bola@school.example",
  firstName: "Bola",
  lastName: "B",
  phone: "080",
  role: "BRANCH_ADMIN",
  branchId: "branch-1",
  branchName: "Main Branch",
  status: "ACTIVE",
  createdAt: "2026-01-02T00:00:00Z",
};

function mockAdmins(admins: SchoolUserView[]) {
  vi.mocked(usersApi.listAdmins).mockResolvedValue({
    content: admins,
    totalElements: admins.length,
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
  render(<AdministratorsPage />);
}

describe("AdministratorsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBranchStore();
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [MAIN_BRANCH],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
  });

  it("lists administrators with branch and status", async () => {
    mockAdmins([SELF, BRANCH_ADMIN]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("bola@school.example")).toBeInTheDocument();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Main Branch")).toBeInTheDocument();
    expect(within(table).getAllByText("ACTIVE").length).toBeGreaterThan(0);
  });

  it("creates a branch admin and keeps the temporary password collapsed until revealed", async () => {
    mockAdmins([SELF]);
    const created: CreateUserResult = {
      user: { id: "branch-admin-1", email: "bola@school.example", firstName: "Bola", lastName: "B", role: "BRANCH_ADMIN" },
      temporaryPassword: "Xk4p-9Fmz",
    };
    vi.mocked(usersApi.createBranchAdmin).mockResolvedValue(created);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("admin@school.example");

    await user.click(screen.getByRole("button", { name: "Add branch admin" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("First name"), "Bola");
    await user.type(within(dialog).getByLabelText("Last name"), "B");
    await user.type(within(dialog).getByLabelText("Email"), "bola@school.example");
    await user.click(within(dialog).getByRole("button", { name: "Create branch admin" }));

    expect(usersApi.createBranchAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Bola",
        lastName: "B",
        email: "bola@school.example",
        branchId: "branch-1",
      }),
    );

    const confirmDialog = await screen.findByRole("dialog");
    expect(within(confirmDialog).getByText(/welcome email has been sent/)).toBeInTheDocument();
    expect(within(confirmDialog).queryByText("Xk4p-9Fmz")).not.toBeInTheDocument();

    await user.click(within(confirmDialog).getByRole("button", { name: /Show credentials/ }));
    expect(within(confirmDialog).getByText("Xk4p-9Fmz")).toBeInTheDocument();
  });

  it("edits a branch admin with a prefilled form and no branch field, then refreshes the list", async () => {
    mockAdmins([SELF, BRANCH_ADMIN]);
    vi.mocked(usersApi.updateBranchAdmin).mockResolvedValue({ ...BRANCH_ADMIN, lastName: "Balogun", phone: "081" });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("bola@school.example");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit administrator" });
    expect(within(dialog).getByLabelText("First name")).toHaveValue("Bola");
    expect(within(dialog).getByLabelText("Last name")).toHaveValue("B");
    expect(within(dialog).getByLabelText("Email")).toHaveValue("bola@school.example");
    expect(within(dialog).getByLabelText("Phone")).toHaveValue("080");
    expect(within(dialog).queryByLabelText("Branch")).not.toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Last name"));
    await user.type(within(dialog).getByLabelText("Last name"), "Balogun");
    await user.clear(within(dialog).getByLabelText("Phone"));
    await user.type(within(dialog).getByLabelText("Phone"), "081");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(usersApi.updateBranchAdmin).toHaveBeenCalledWith(
      "branch-admin-1",
      expect.objectContaining({
        firstName: "Bola",
        lastName: "Balogun",
        email: "bola@school.example",
        phone: "081",
      }),
    );
    expect(usersApi.listAdmins).toHaveBeenCalledTimes(2);
    await screen.findByRole("button", { name: "Add branch admin" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables a branch admin through a confirmation dialog", async () => {
    mockAdmins([SELF, BRANCH_ADMIN]);
    vi.mocked(usersApi.disableUser).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await user.click(await screen.findByRole("button", { name: "Disable" }));

    const dialog = await screen.findByRole("dialog", { name: "Disable this administrator?" });
    await user.click(within(dialog).getByRole("button", { name: "Disable" }));

    expect(usersApi.disableUser).toHaveBeenCalledWith("branch-admin-1");
  });

  it("shows no Edit/Disable controls for a SCHOOL_ADMIN row, including the caller's own row", async () => {
    mockAdmins([SELF, BRANCH_ADMIN]);

    renderAsSchoolAdmin();
    await screen.findByText("bola@school.example");

    // Only the branch admin's row gets an Edit/Disable pair - the caller's own
    // SCHOOL_ADMIN row offers neither (no self-disable, no peer-admin editing here).
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Disable" })).toHaveLength(1);
  });
});
