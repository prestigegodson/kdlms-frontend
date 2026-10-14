import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/api/contactEnquiries";
import { useContactEnquiriesUnreadStore } from "@/stores/contactEnquiriesUnreadStore";
import { EnquiriesPage } from "./EnquiriesPage";
import { enquiry, page } from "./fixtures";

vi.mock("@/api/contactEnquiries");

function renderPage() {
  render(
    <MemoryRouter>
      <EnquiriesPage />
    </MemoryRouter>,
  );
}

describe("EnquiriesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useContactEnquiriesUnreadStore.setState({ count: 0, status: "idle" });
  });

  it("opens on the new enquiries and lists each one's school, contact and status", async () => {
    vi.mocked(api.listContactEnquiries).mockResolvedValue(page([enquiry()]));
    renderPage();

    expect(await screen.findByText("Bright Futures Academy")).toBeInTheDocument();
    expect(screen.getByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("+2348012345678 · head@bright.example")).toBeInTheDocument();
    expect(screen.getByText("Please tell us about pricing.")).toBeInTheDocument();
    expect(api.listContactEnquiries).toHaveBeenCalledWith("", "NEW", 0, 20);
  });

  it("lists every status from the All tab", async () => {
    vi.mocked(api.listContactEnquiries).mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();

    vi.mocked(api.listContactEnquiries).mockResolvedValue(
      page([enquiry({ status: "RESOLVED", contactEmail: null })]),
    );
    await userEvent.click(screen.getByRole("tab", { name: "All" }));

    expect(api.listContactEnquiries).toHaveBeenLastCalledWith("", "", 0, 20);
    // The tab and the row's status badge.
    await waitFor(() => expect(screen.getAllByText("Resolved")).toHaveLength(2));
  });

  it("shows the unread count on the New tab", async () => {
    useContactEnquiriesUnreadStore.setState({ count: 3, status: "loaded" });
    vi.mocked(api.listContactEnquiries).mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByRole("tab", { name: "New (3 pending)" })).toBeInTheDocument();
  });

  it("explains a failed load", async () => {
    vi.mocked(api.listContactEnquiries).mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
