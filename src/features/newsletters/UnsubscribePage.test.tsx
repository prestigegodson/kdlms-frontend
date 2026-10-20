import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as api from "@/api/newsletters";
import { UnsubscribePage } from "./UnsubscribePage";

vi.mock("@/api/newsletters");

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <UnsubscribePage />
    </MemoryRouter>,
  );
}

describe("UnsubscribePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only unsubscribes once the reader confirms", async () => {
    vi.mocked(api.getUnsubscribeStatus).mockResolvedValue({
      maskedEmail: "a***@example.com",
      unsubscribed: false,
    });
    vi.mocked(api.confirmUnsubscribe).mockResolvedValue({
      maskedEmail: "a***@example.com",
      unsubscribed: true,
    });
    renderAt("/unsubscribe?token=abc.def");

    expect(await screen.findByText("a***@example.com")).toBeInTheDocument();
    expect(api.getUnsubscribeStatus).toHaveBeenCalledWith("abc.def");
    expect(api.confirmUnsubscribe).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Unsubscribe" }));

    expect(api.confirmUnsubscribe).toHaveBeenCalledWith("abc.def");
    expect(await screen.findByText(/won't get KDLMS newsletters any more/)).toBeInTheDocument();
  });

  it("says so when the address is already unsubscribed", async () => {
    vi.mocked(api.getUnsubscribeStatus).mockResolvedValue({
      maskedEmail: "a***@example.com",
      unsubscribed: true,
    });
    renderAt("/unsubscribe?token=abc.def");

    expect(await screen.findByText(/won't get KDLMS newsletters any more/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unsubscribe" })).not.toBeInTheDocument();
  });

  it("explains an invalid or missing link", async () => {
    vi.mocked(api.getUnsubscribeStatus).mockRejectedValue(
      new ApiError(404, "This unsubscribe link has expired."),
    );
    renderAt("/unsubscribe?token=bad");
    expect(await screen.findByText("This unsubscribe link has expired.")).toBeInTheDocument();
  });

  it("explains a link with no token", () => {
    renderAt("/unsubscribe");
    expect(screen.getByText("This unsubscribe link is incomplete.")).toBeInTheDocument();
  });
});
