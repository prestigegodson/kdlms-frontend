import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/api/contactEnquiries";
import { useContactEnquiriesUnreadStore } from "@/stores/contactEnquiriesUnreadStore";
import { EnquiryDetailPage } from "./EnquiryDetailPage";
import { enquiry } from "./fixtures";

vi.mock("@/api/contactEnquiries");

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/admin/enquiries/e1"]}>
      <Routes>
        <Route path="/admin/enquiries/:enquiryId" element={<EnquiryDetailPage />} />
        <Route path="/admin/enquiries" element={<p>inbox</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("EnquiryDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useContactEnquiriesUnreadStore.setState({ count: 1, status: "loaded" });
    vi.mocked(api.getUnreadContactEnquiryCount).mockResolvedValue({ count: 0 });
  });

  it("marks a new enquiry read on opening and shows every field", async () => {
    vi.mocked(api.getContactEnquiry).mockResolvedValue(enquiry());
    vi.mocked(api.setContactEnquiryStatus).mockResolvedValue(enquiry({ status: "READ" }));
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Bright Futures Academy" }),
    ).toBeInTheDocument();
    expect(api.setContactEnquiryStatus).toHaveBeenCalledWith("e1", "READ");
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+2348012345678" })).toHaveAttribute(
      "href",
      "tel:+2348012345678",
    );
    expect(screen.getByRole("link", { name: "head@bright.example" })).toHaveAttribute(
      "href",
      "mailto:head@bright.example",
    );
    expect(screen.getByText("Please tell us about pricing.")).toBeInTheDocument();
    await waitFor(() => expect(useContactEnquiriesUnreadStore.getState().count).toBe(0));
  });

  it("leaves an already-read enquiry's status alone and can resolve it", async () => {
    vi.mocked(api.getContactEnquiry).mockResolvedValue(enquiry({ status: "READ", message: null }));
    vi.mocked(api.setContactEnquiryStatus).mockResolvedValue(enquiry({ status: "RESOLVED" }));
    renderPage();

    expect(await screen.findByText("No message was included.")).toBeInTheDocument();
    expect(api.setContactEnquiryStatus).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Mark resolved" }));

    expect(api.setContactEnquiryStatus).toHaveBeenCalledWith("e1", "RESOLVED");
    expect(await screen.findByRole("button", { name: "Reopen" })).toBeInTheDocument();
  });

  it("deletes after confirming and returns to the inbox", async () => {
    vi.mocked(api.getContactEnquiry).mockResolvedValue(enquiry({ status: "READ" }));
    vi.mocked(api.deleteContactEnquiry).mockResolvedValue(undefined);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(api.deleteContactEnquiry).toHaveBeenCalledWith("e1");
    expect(await screen.findByText("inbox")).toBeInTheDocument();
  });
});
