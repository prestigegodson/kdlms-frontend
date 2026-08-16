import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as supportContactApi from "@/api/supportContact";
import { AdminSupportContactPage } from "@/features/support/AdminSupportContactPage";

vi.mock("@/api/supportContact", async () => {
  const actual = await vi.importActual<typeof import("@/api/supportContact")>("@/api/supportContact");
  return { ...actual, getAdminSupportContact: vi.fn(), updateSupportContact: vi.fn() };
});

describe("AdminSupportContactPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the current values, edits them, saves, and shows a success alert", async () => {
    vi.mocked(supportContactApi.getAdminSupportContact).mockResolvedValue({
      supportEmail: null,
      supportPhone: null,
      whatsappNumber: null,
    });
    vi.mocked(supportContactApi.updateSupportContact).mockResolvedValue({
      supportEmail: "support@kdlms.com",
      supportPhone: "+2348012345678",
      whatsappNumber: "+2348012345678",
    });
    const user = userEvent.setup();
    render(<AdminSupportContactPage />);

    const emailInput = await screen.findByLabelText("Support email");
    await user.type(emailInput, "support@kdlms.com");
    await user.type(screen.getByLabelText("Support phone"), "+2348012345678");
    await user.type(screen.getByLabelText("WhatsApp number"), "+2348012345678");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(supportContactApi.updateSupportContact).toHaveBeenCalledWith({
      supportEmail: "support@kdlms.com",
      supportPhone: "+2348012345678",
      whatsappNumber: "+2348012345678",
    });
    expect(await screen.findByText("Support contact updated.")).toBeInTheDocument();
  });

  it("shows an error alert when loading fails", async () => {
    vi.mocked(supportContactApi.getAdminSupportContact).mockRejectedValue(new Error("boom"));
    render(<AdminSupportContactPage />);

    expect(await screen.findByText("Failed to load support contact")).toBeInTheDocument();
  });
});
