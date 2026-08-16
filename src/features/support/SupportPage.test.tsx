import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as supportContactApi from "@/api/supportContact";
import { SupportPage } from "@/features/support/SupportPage";

vi.mock("@/api/supportContact", async () => {
  const actual = await vi.importActual<typeof import("@/api/supportContact")>("@/api/supportContact");
  return { ...actual, getSupportContact: vi.fn() };
});

describe("SupportPage", () => {
  it("renders all three links with the correct hrefs, digit-stripping the WhatsApp number", async () => {
    vi.mocked(supportContactApi.getSupportContact).mockResolvedValue({
      supportEmail: "support@kdlms.com",
      supportPhone: "+234 801 234 5678",
      whatsappNumber: "+234 801 234 5678",
    });
    render(<SupportPage />);

    const emailLink = await screen.findByRole("link", { name: /support@kdlms\.com/ });
    expect(emailLink).toHaveAttribute("href", "mailto:support@kdlms.com");

    const phoneLink = screen.getByRole("link", { name: /Phone/ });
    expect(phoneLink).toHaveAttribute("href", "tel:+234 801 234 5678");

    const whatsappLink = screen.getByRole("link", { name: /WhatsApp/ });
    expect(whatsappLink).toHaveAttribute("href", "https://wa.me/2348012345678");
  });

  it("renders an empty state when no contact details are published yet", async () => {
    vi.mocked(supportContactApi.getSupportContact).mockResolvedValue({
      supportEmail: null,
      supportPhone: null,
      whatsappNumber: null,
    });
    render(<SupportPage />);

    expect(await screen.findByText("No support contact yet")).toBeInTheDocument();
  });

  it("shows an error alert when loading fails", async () => {
    vi.mocked(supportContactApi.getSupportContact).mockRejectedValue(new Error("boom"));
    render(<SupportPage />);

    expect(await screen.findByText("Failed to load support contact")).toBeInTheDocument();
  });
});
