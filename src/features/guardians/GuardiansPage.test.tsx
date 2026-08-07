import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as guardiansApi from "@/api/guardians";
import type { GuardianView } from "@/api/guardians";
import { GuardiansPage } from "@/features/guardians/GuardiansPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/guardians", async () => {
  const actual = await vi.importActual<typeof import("@/api/guardians")>("@/api/guardians");
  return {
    ...actual,
    listGuardians: vi.fn(),
    createGuardian: vi.fn(),
    updateGuardian: vi.fn(),
    enableGuardian: vi.fn(),
    disableGuardian: vi.fn(),
    listGuardianWards: vi.fn(),
  };
});

const GUARDIAN_VIEW: GuardianView = {
  id: "guardian-1",
  schoolId: "school-1",
  firstName: "Chidi",
  lastName: "Obi",
  fullName: "Chidi Obi",
  email: "chidi@example.com",
  phone: "08012345678",
  active: true,
  communicationEmailsEnabled: true,
};

function mockGuardians(guardians: GuardianView[]) {
  vi.mocked(guardiansApi.listGuardians).mockResolvedValue({
    content: guardians,
    totalElements: guardians.length,
    totalPages: 1,
    number: 0,
    size: 20,
  });
}

function renderAsSchoolAdmin() {
  resetAuthStore();
  useAuthStore.setState({
    user: { id: "user-1", email: "admin@school.example", firstName: "Ada", lastName: "Obi", role: "SCHOOL_ADMIN", schoolId: "school-1" },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <GuardiansPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("GuardiansPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists guardians with their status", async () => {
    mockGuardians([GUARDIAN_VIEW]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("Chidi Obi")).toBeInTheDocument();
    expect(screen.getByText("chidi@example.com")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("creates a guardian and reveals the temporary password", async () => {
    mockGuardians([]);
    vi.mocked(guardiansApi.createGuardian).mockResolvedValue({
      guardian: GUARDIAN_VIEW,
      temporaryPassword: "temp-pass-123",
    });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No guardians found/);

    await user.click(screen.getByRole("button", { name: "Add guardian" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("First name"), "Chidi");
    await user.type(within(dialog).getByLabelText("Last name"), "Obi");
    await user.type(within(dialog).getByLabelText("Email"), "chidi@example.com");
    await user.click(within(dialog).getByRole("button", { name: "Create guardian" }));

    expect(guardiansApi.createGuardian).toHaveBeenCalledWith(
      expect.objectContaining({ email: "chidi@example.com", firstName: "Chidi", lastName: "Obi" }),
    );
    expect(await screen.findByText("Guardian created")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show credentials (if the welcome email didn't arrive)" }));
    expect(screen.getByText("temp-pass-123")).toBeInTheDocument();
  });

  it("disables an active guardian", async () => {
    mockGuardians([GUARDIAN_VIEW]);
    vi.mocked(guardiansApi.disableGuardian).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Chidi Obi");

    await user.click(screen.getByRole("button", { name: "Disable" }));

    expect(guardiansApi.disableGuardian).toHaveBeenCalledWith("guardian-1");
  });

  it("shows a guardian's wards, linked to their student profile", async () => {
    mockGuardians([GUARDIAN_VIEW]);
    vi.mocked(guardiansApi.listGuardianWards).mockResolvedValue([
      { studentId: "student-1", studentName: "Ada Obi", admissionNumber: "BFA/2026/0001", relationship: "FATHER" },
    ]);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Chidi Obi");

    await user.click(screen.getByRole("button", { name: "View wards" }));

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("BFA/2026/0001")).toBeInTheDocument();
    const wardLink = screen.getByRole("link", { name: /Ada Obi/ });
    expect(wardLink).toHaveAttribute("href", "/school/students/student-1");
  });

  it("edits a guardian's details", async () => {
    mockGuardians([GUARDIAN_VIEW]);
    vi.mocked(guardiansApi.updateGuardian).mockResolvedValue({ ...GUARDIAN_VIEW, phone: "08099999999" });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Chidi Obi");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit guardian" });

    expect(within(dialog).getByLabelText("First name")).toHaveValue("Chidi");
    expect(within(dialog).getByLabelText("Email")).toHaveValue("chidi@example.com");
    expect(within(dialog).getByText(/also the guardian's sign-in email/)).toBeInTheDocument();

    const phoneInput = within(dialog).getByLabelText("Phone");
    await user.clear(phoneInput);
    await user.type(phoneInput, "08099999999");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(guardiansApi.updateGuardian).toHaveBeenCalledWith(
      "guardian-1",
      expect.objectContaining({ email: "chidi@example.com", firstName: "Chidi", lastName: "Obi", phone: "08099999999" }),
    );
  });

  it("mutes a guardian's communication email from the edit form", async () => {
    mockGuardians([GUARDIAN_VIEW]);
    vi.mocked(guardiansApi.updateGuardian).mockResolvedValue({ ...GUARDIAN_VIEW, communicationEmailsEnabled: false });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Chidi Obi");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit guardian" });

    const emailToggle = within(dialog).getByRole("checkbox", { name: "Send email notifications for new messages" });
    expect(emailToggle).toBeChecked();
    await user.click(emailToggle);
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(guardiansApi.updateGuardian).toHaveBeenCalledWith(
      "guardian-1",
      expect.objectContaining({ communicationEmailsEnabled: false }),
    );
  });
});
