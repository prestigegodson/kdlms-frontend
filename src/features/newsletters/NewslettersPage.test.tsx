import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/api/newsletters";
import { newsletter } from "./fixtures";
import { NewslettersPage } from "./NewslettersPage";

vi.mock("@/api/newsletters");

function page(content: api.NewsletterSummaryView[]) {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 20 };
}

function renderPage() {
  render(
    <MemoryRouter>
      <NewslettersPage />
    </MemoryRouter>,
  );
}

describe("NewslettersPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists newsletters with their status and delivery numbers", async () => {
    vi.mocked(api.listNewsletters).mockResolvedValue(
      page([
        newsletter({ id: "n1", subject: "Draft one" }),
        newsletter({
          id: "n2",
          subject: "Sent one",
          status: "SENT",
          startedAt: "2026-10-02T09:00:00Z",
          recipientCount: 10,
          sentCount: 9,
          failedCount: 1,
        }),
      ]),
    );
    renderPage();

    expect(await screen.findByText("Draft one")).toBeInTheDocument();
    expect(screen.getByText("Sent one")).toBeInTheDocument();
    expect(screen.getByText("9 / 10")).toBeInTheDocument();
    expect(screen.getByText("(1 failed)")).toBeInTheDocument();
    expect(api.listNewsletters).toHaveBeenCalledWith("", 0, 20);
  });

  it("filters by status", async () => {
    vi.mocked(api.listNewsletters).mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText("No newsletters")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Scheduled" }));

    expect(api.listNewsletters).toHaveBeenLastCalledWith("SCHEDULED", 0, 20);
  });
});
