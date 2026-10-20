import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/api/newsletters";
import { listPackages } from "@/api/packages";
import { audiencePreview, newsletter } from "./fixtures";
import { NewsletterEditorPage } from "./NewsletterEditorPage";

vi.mock("@/api/newsletters");
vi.mock("@/api/packages");
vi.mock("@/api/schools");

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/newsletters/new" element={<NewsletterEditorPage />} />
        <Route path="/admin/newsletters/:newsletterId" element={<NewsletterEditorPage />} />
        <Route path="/admin/newsletters" element={<p>list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("NewsletterEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPackages).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 100,
    });
    vi.mocked(api.previewAudience).mockResolvedValue(audiencePreview());
  });

  it("previews pasted HTML with sample merge values and shows the live recipient count", async () => {
    renderAt("/admin/newsletters/new");

    fireEvent.change(screen.getByPlaceholderText(/paste your newsletter HTML/i), {
      target: { value: "<html><body><h1>Hi {{name}}</h1></body></html>" },
    });

    await waitFor(() =>
      expect(screen.getByTitle("Newsletter preview")).toHaveAttribute(
        "srcdoc",
        expect.stringContaining("<h1>Hi Ada Obi</h1>"),
      ),
    );
    expect(
      await screen.findByText("40 recipients", undefined, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 unsubscribed, left out/)).toBeInTheDocument();
  });

  it("saves a new draft and sends it after confirming the recipient count", async () => {
    vi.mocked(api.createNewsletter).mockResolvedValue(newsletter());
    vi.mocked(api.sendNewsletterNow).mockResolvedValue(
      newsletter({ status: "SENDING", recipientCount: 40 }),
    );
    renderAt("/admin/newsletters/new");
    await screen.findByText("40 recipients", undefined, { timeout: 2000 });

    await userEvent.type(screen.getByLabelText("Subject"), "October news");
    fireEvent.change(screen.getByPlaceholderText(/paste your newsletter HTML/i), {
      target: { value: "<p>Hello</p>" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Send now" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/It will go to 40 people/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Send now" }));

    await waitFor(() => expect(api.sendNewsletterNow).toHaveBeenCalledWith("n1"));
    expect(api.createNewsletter).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "October news", htmlBody: "<p>Hello</p>" }),
    );
    expect(await screen.findByText("Sending has started.")).toBeInTheDocument();
  });

  it("refuses to send without a subject", async () => {
    renderAt("/admin/newsletters/new");

    await userEvent.click(screen.getByRole("button", { name: "Send now" }));

    expect(screen.getByText("Give the newsletter a subject first.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("schedules a saved draft for the chosen time", async () => {
    vi.mocked(api.getNewsletter).mockResolvedValue(newsletter());
    vi.mocked(api.scheduleNewsletter).mockResolvedValue(
      newsletter({ status: "SCHEDULED", scheduledAt: "2030-01-01T09:00:00Z" }),
    );
    renderAt("/admin/newsletters/n1");
    expect(await screen.findByRole("heading", { name: "October news" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Schedule" }),
    );

    await waitFor(() =>
      expect(api.scheduleNewsletter).toHaveBeenCalledWith("n1", expect.any(String)),
    );
    // Nothing changed since loading, so nothing is re-saved first.
    expect(api.updateNewsletter).not.toHaveBeenCalled();
    expect(await screen.findByText(/Goes out/)).toBeInTheDocument();
  });

  it("shows a scheduled newsletter read-only and can unschedule it", async () => {
    vi.mocked(api.getNewsletter).mockResolvedValue(
      newsletter({ status: "SCHEDULED", scheduledAt: "2030-01-01T09:00:00Z" }),
    );
    vi.mocked(api.unscheduleNewsletter).mockResolvedValue(newsletter());
    renderAt("/admin/newsletters/n1");

    expect(await screen.findByText(/Goes out/)).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Send now" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Unschedule" }));

    expect(api.unscheduleNewsletter).toHaveBeenCalledWith("n1");
    expect(await screen.findByRole("button", { name: "Send now" })).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toBeEnabled();
  });

  it("shows a sent newsletter's delivery numbers", async () => {
    vi.mocked(api.getNewsletter).mockResolvedValue(
      newsletter({
        status: "SENT",
        recipientCount: 40,
        sentCount: 39,
        failedCount: 1,
        suppressedCount: 2,
        completedAt: "2026-10-02T09:05:00Z",
      }),
    );
    renderAt("/admin/newsletters/n1");

    expect(await screen.findByText("Recipients")).toBeInTheDocument();
    expect(screen.getByText("39")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});
